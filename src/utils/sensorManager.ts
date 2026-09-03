import { OrientationData, MotionData, BarometerData, GpsData } from '../types';

export class SensorManager {
  private orientationListeners: Array<(data: OrientationData) => void> = [];
  private motionListeners: Array<(data: MotionData) => void> = [];
  private barometerListeners: Array<(data: BarometerData) => void> = [];
  private gpsListeners: Array<(data: GpsData) => void> = [];

  // Tare offsets
  private pitchOffset = 0;
  private rollOffset = 0;
  private yawOffset = 0;
  private altitudeBaseM = 0;
  private qnhRefHpa = 1013.25;

  // Max / Min tracking
  private maxG = 1.0;
  private minG = 1.0;

  // Barometer state
  private pressureSensorInstance: any = null;
  private lastPressureHpa = 1013.25;
  private lastPressureTime = Date.now();
  private lastAltitudeM = 0;
  private verticalSpeedMps = 0;
  private isBaroHardware = false;

  // Simulator loop
  private isSimulated = false;
  private simTimer: any = null;
  private simAngle = 0;

  // Active flags
  private isListening = false;
  private geoWatchId: number | null = null;

  // Current states
  private currentOrientation: OrientationData = {
    pitch: 0,
    roll: 0,
    yaw: 0,
    absolute: false,
    calibratedPitch: 0,
    calibratedRoll: 0,
    calibratedYaw: 0,
  };

  private currentMotion: MotionData = {
    accX: 0,
    accY: 0,
    accZ: 0,
    gravityX: 0,
    gravityY: 0,
    gravityZ: 9.81,
    totalG: 1.0,
    maxG: 1.0,
    minG: 1.0,
    rotRateAlpha: 0,
    rotRateBeta: 0,
    rotRateGamma: 0,
    interval: 16,
  };

  private currentBarometer: BarometerData = {
    pressureHpa: 1013.25,
    pressureInHg: 29.92,
    altitudeM: 0,
    altitudeFt: 0,
    relativeAltitudeM: 0,
    verticalSpeedMps: 0,
    verticalSpeedFpm: 0,
    seaLevelRefHpa: 1013.25,
    isHardwareNative: false,
    sensorStatus: 'estimating',
  };

  private currentGps: GpsData = {
    latitude: null,
    longitude: null,
    altitudeGpsM: null,
    speedMps: null,
    headingDeg: null,
    accuracyM: null,
    available: false,
  };

  constructor() {
    // Initial check
  }

  public async requestPermissions(): Promise<{ orientation: boolean; motion: boolean; baro: boolean; gps: boolean }> {
    const results = { orientation: false, motion: false, baro: false, gps: false };

    // iOS 13+ DeviceOrientationEvent permission
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        results.orientation = response === 'granted';
      } catch (e) {
        console.warn('DeviceOrientation permission error:', e);
      }
    } else {
      results.orientation = true;
    }

    // iOS 13+ DeviceMotionEvent permission
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        results.motion = response === 'granted';
      } catch (e) {
        console.warn('DeviceMotion permission error:', e);
      }
    } else {
      results.motion = true;
    }

    // Generic Sensor API for Pressure
    if ('AmbientPressureSensor' in window || 'PressureSensor' in window) {
      try {
        if ('permissions' in navigator) {
          const status = await (navigator.permissions as any).query({ name: 'ambient-light-sensor' as any });
          results.baro = status.state !== 'denied';
        } else {
          results.baro = true;
        }
      } catch {
        results.baro = true;
      }
    }

    // Geolocation
    if ('geolocation' in navigator) {
      results.gps = true;
    }

    return results;
  }

  public start(): void {
    if (this.isListening) return;
    this.isListening = true;

    // Attach orientation
    window.addEventListener('deviceorientation', this.handleOrientation, true);
    window.addEventListener('deviceorientationabsolute' as any, this.handleOrientation, true);

    // Attach motion
    window.addEventListener('devicemotion', this.handleMotion, true);

    // Attach AmbientPressureSensor if supported
    this.initHardwareBarometer();

    // Attach Geolocation
    this.initGeolocation();

    // Check if hardware delivers values after 1.5s; if not, enable graceful auto-emulation
    setTimeout(() => {
      if (
        Math.abs(this.currentOrientation.pitch) < 0.001 &&
        Math.abs(this.currentOrientation.roll) < 0.001 &&
        Math.abs(this.currentMotion.accX) < 0.001 &&
        Math.abs(this.currentMotion.rotRateBeta) < 0.001
      ) {
        // Desktop or restricted browser: enable interactive simulation so edge HUD thrives!
        if (!this.isSimulated) {
          this.setSimulated(true);
        }
      }
    }, 1500);
  }

  public stop(): void {
    this.isListening = false;
    window.removeEventListener('deviceorientation', this.handleOrientation, true);
    window.removeEventListener('deviceorientationabsolute' as any, this.handleOrientation, true);
    window.removeEventListener('devicemotion', this.handleMotion, true);

    if (this.pressureSensorInstance) {
      try {
        this.pressureSensorInstance.stop();
      } catch {
        // ignore
      }
      this.pressureSensorInstance = null;
    }

    if (this.geoWatchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }

    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
  }

  private handleOrientation = (e: DeviceOrientationEvent): void => {
    if (this.isSimulated) return;

    let yaw = e.alpha ?? 0;
    // iOS provides webkitCompassHeading directly (true north compass)
    if ((e as any).webkitCompassHeading !== undefined) {
      yaw = (e as any).webkitCompassHeading;
    }

    const pitch = e.beta ?? 0;
    const roll = e.gamma ?? 0;

    let calPitch = pitch - this.pitchOffset;
    let calRoll = roll - this.rollOffset;
    let calYaw = (yaw - this.yawOffset + 360) % 360;

    // Normalize pitch to -180..180
    if (calPitch > 180) calPitch -= 360;
    if (calPitch < -180) calPitch += 360;

    this.currentOrientation = {
      pitch: Number(pitch.toFixed(1)),
      roll: Number(roll.toFixed(1)),
      yaw: Number(yaw.toFixed(1)),
      absolute: e.absolute ?? false,
      calibratedPitch: Number(calPitch.toFixed(1)),
      calibratedRoll: Number(calRoll.toFixed(1)),
      calibratedYaw: Number(calYaw.toFixed(1)),
    };

    this.orientationListeners.forEach((fn) => fn(this.currentOrientation));
  };

  private handleMotion = (e: DeviceMotionEvent): void => {
    if (this.isSimulated) return;

    const acc = e.acceleration || { x: 0, y: 0, z: 0 };
    const accG = e.accelerationIncludingGravity || { x: 0, y: 0, z: 9.81 };
    const rot = e.rotationRate || { alpha: 0, beta: 0, gamma: 0 };

    const gx = accG.x ?? 0;
    const gy = accG.y ?? 0;
    const gz = accG.z ?? 9.81;

    // Total G force magnitude
    const gMagnitude = Math.sqrt(gx * gx + gy * gy + gz * gz) / 9.80665;
    if (gMagnitude > this.maxG) this.maxG = gMagnitude;
    if (gMagnitude < this.minG && gMagnitude > 0.05) this.minG = gMagnitude;

    this.currentMotion = {
      accX: Number((acc.x ?? 0).toFixed(2)),
      accY: Number((acc.y ?? 0).toFixed(2)),
      accZ: Number((acc.z ?? 0).toFixed(2)),
      gravityX: Number(gx.toFixed(2)),
      gravityY: Number(gy.toFixed(2)),
      gravityZ: Number(gz.toFixed(2)),
      totalG: Number(gMagnitude.toFixed(2)),
      maxG: Number(this.maxG.toFixed(2)),
      minG: Number(this.minG.toFixed(2)),
      rotRateAlpha: Number((rot.alpha ?? 0).toFixed(1)),
      rotRateBeta: Number((rot.beta ?? 0).toFixed(1)),
      rotRateGamma: Number((rot.gamma ?? 0).toFixed(1)),
      interval: e.interval || 16,
    };

    this.motionListeners.forEach((fn) => fn(this.currentMotion));

    // If barometer is hardware-less, motion Z changes can inform realistic relative pressure shifts
    if (!this.isBaroHardware) {
      this.updateEstimatedBarometer(this.currentMotion.accZ);
    }
  };

  private initHardwareBarometer(): void {
    const SensorClass = (window as any).AmbientPressureSensor || (window as any).PressureSensor;
    if (SensorClass) {
      try {
        const sensor = new SensorClass({ frequency: 10 });
        sensor.addEventListener('reading', () => {
          if (typeof sensor.pressure === 'number') {
            this.isBaroHardware = true;
            this.processBarometerReading(sensor.pressure, true);
          }
        });
        sensor.addEventListener('error', (err: any) => {
          console.warn('Hardware barometer error:', err);
          this.isBaroHardware = false;
        });
        sensor.start();
        this.pressureSensorInstance = sensor;
      } catch (e) {
        console.warn('Could not initialize AmbientPressureSensor:', e);
        this.isBaroHardware = false;
      }
    } else {
      this.isBaroHardware = false;
    }
  }

  private initGeolocation(): void {
    if ('geolocation' in navigator) {
      try {
        this.geoWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            this.currentGps = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitudeGpsM: pos.coords.altitude !== null ? Number(pos.coords.altitude.toFixed(1)) : null,
              speedMps: pos.coords.speed !== null ? Number(pos.coords.speed.toFixed(1)) : null,
              headingDeg: pos.coords.heading !== null ? Number(pos.coords.heading.toFixed(1)) : null,
              accuracyM: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
              available: true,
            };

            // If barometer is hardware-less and GPS has altitude, calibrate pressure estimate
            if (!this.isBaroHardware && pos.coords.altitude !== null) {
              const estimatedHpa = 1013.25 * Math.pow(1 - 2.25577e-5 * pos.coords.altitude, 5.25588);
              this.processBarometerReading(estimatedHpa, false);
            }

            this.gpsListeners.forEach((fn) => fn(this.currentGps));
          },
          (err) => {
            console.warn('GPS error:', err.message);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
        );
      } catch (e) {
        console.warn('Geolocation failed:', e);
      }
    }
  }

  private updateEstimatedBarometer(verticalAcc: number): void {
    // Small realistic micro-variation with atmospheric fluctuations + motion
    const now = Date.now();
    const dt = (now - this.lastPressureTime) / 1000;
    if (dt < 0.1) return;

    // Slight atmospheric micro-pressure drift
    const microJitter = (Math.sin(now / 3500) * 0.05) + (verticalAcc * -0.015);
    const targetHpa = Math.max(900, Math.min(1080, this.lastPressureHpa + microJitter * dt));
    this.processBarometerReading(targetHpa, false);
  }

  private processBarometerReading(pressureHpa: number, isNativeHardware: boolean): void {
    const now = Date.now();
    const dt = Math.max(0.05, (now - this.lastPressureTime) / 1000);
    this.lastPressureTime = now;
    this.lastPressureHpa = pressureHpa;

    // Standard International Barometric Formula:
    // Altitude (m) = 44330.77 * [1 - (P / P0)^(1 / 5.25588)]
    const pRatio = Math.max(0.01, pressureHpa / this.qnhRefHpa);
    const absoluteAltitudeM = 44330.77 * (1 - Math.pow(pRatio, 0.190263));
    const relativeAltitudeM = absoluteAltitudeM - this.altitudeBaseM;

    // Compute Vertical Speed (rate of climb in m/s) with smoothing filter
    const rawVsi = (absoluteAltitudeM - this.lastAltitudeM) / dt;
    this.verticalSpeedMps = this.verticalSpeedMps * 0.75 + rawVsi * 0.25;
    this.lastAltitudeM = absoluteAltitudeM;

    const pressureInHg = pressureHpa * 0.02952998;
    const altitudeFt = absoluteAltitudeM * 3.28084;
    const verticalSpeedFpm = this.verticalSpeedMps * 196.85;

    this.currentBarometer = {
      pressureHpa: Number(pressureHpa.toFixed(2)),
      pressureInHg: Number(pressureInHg.toFixed(2)),
      altitudeM: Number(absoluteAltitudeM.toFixed(1)),
      altitudeFt: Number(altitudeFt.toFixed(0)),
      relativeAltitudeM: Number(relativeAltitudeM.toFixed(1)),
      verticalSpeedMps: Number(this.verticalSpeedMps.toFixed(2)),
      verticalSpeedFpm: Number(verticalSpeedFpm.toFixed(0)),
      seaLevelRefHpa: this.qnhRefHpa,
      isHardwareNative: isNativeHardware,
      sensorStatus: isNativeHardware ? 'active' : 'emulated',
    };

    this.barometerListeners.forEach((fn) => fn(this.currentBarometer));
  }

  public tareZero(): void {
    // Zero out pitch, roll, and relative altitude
    this.pitchOffset = this.currentOrientation.pitch;
    this.rollOffset = this.currentOrientation.roll;
    this.yawOffset = this.currentOrientation.yaw;
    this.altitudeBaseM = this.currentBarometer.altitudeM;
    this.maxG = 1.0;
    this.minG = 1.0;

    // Update orientation immediately
    this.currentOrientation.calibratedPitch = 0;
    this.currentOrientation.calibratedRoll = 0;
    this.currentOrientation.calibratedYaw = 0;
    this.currentBarometer.relativeAltitudeM = 0;

    this.orientationListeners.forEach((fn) => fn(this.currentOrientation));
    this.barometerListeners.forEach((fn) => fn(this.currentBarometer));
  }

  public setQnh(hpa: number): void {
    this.qnhRefHpa = hpa;
    this.processBarometerReading(this.lastPressureHpa, this.isBaroHardware);
  }

  // Simulator toggle for desktop or testing edge telemetry
  public setSimulated(enabled: boolean): void {
    this.isSimulated = enabled;

    if (enabled) {
      if (this.simTimer) clearInterval(this.simTimer);
      this.simTimer = setInterval(() => {
        this.simAngle += 0.035;

        // Realistic gentle aircraft / phone sweep
        const pitch = Math.sin(this.simAngle * 0.8) * 14;
        const roll = Math.sin(this.simAngle * 0.5) * 22;
        const yaw = (this.simAngle * 25) % 360;

        const calPitch = pitch - this.pitchOffset;
        const calRoll = roll - this.rollOffset;
        const calYaw = (yaw - this.yawOffset + 360) % 360;

        this.currentOrientation = {
          pitch: Number(pitch.toFixed(1)),
          roll: Number(roll.toFixed(1)),
          yaw: Number(yaw.toFixed(1)),
          absolute: true,
          calibratedPitch: Number(calPitch.toFixed(1)),
          calibratedRoll: Number(calRoll.toFixed(1)),
          calibratedYaw: Number(calYaw.toFixed(1)),
        };
        this.orientationListeners.forEach((fn) => fn(this.currentOrientation));

        // Motion
        const accX = Math.sin(this.simAngle * 1.2) * 1.8;
        const accY = Math.cos(this.simAngle * 0.9) * 2.2;
        const accZ = Math.sin(this.simAngle * 1.5) * 1.4;
        const g = 1.0 + Math.sin(this.simAngle * 0.7) * 0.35;
        if (g > this.maxG) this.maxG = g;

        this.currentMotion = {
          accX: Number(accX.toFixed(2)),
          accY: Number(accY.toFixed(2)),
          accZ: Number(accZ.toFixed(2)),
          gravityX: Number((accX + Math.sin(roll * (Math.PI / 180)) * 9.81).toFixed(2)),
          gravityY: Number((accY + Math.sin(pitch * (Math.PI / 180)) * 9.81).toFixed(2)),
          gravityZ: Number((9.81 + accZ).toFixed(2)),
          totalG: Number(g.toFixed(2)),
          maxG: Number(this.maxG.toFixed(2)),
          minG: Number(this.minG.toFixed(2)),
          rotRateAlpha: Number((Math.sin(this.simAngle) * 8).toFixed(1)),
          rotRateBeta: Number((Math.cos(this.simAngle * 0.8) * 6).toFixed(1)),
          rotRateGamma: Number((Math.sin(this.simAngle * 0.5) * 12).toFixed(1)),
          interval: 50,
        };
        this.motionListeners.forEach((fn) => fn(this.currentMotion));

        // Barometer simulation: altitude gently climbs and dives between 40m and 160m
        const altM = 100 + Math.sin(this.simAngle * 0.3) * 60;
        const simHpa = 1013.25 * Math.pow(1 - 2.25577e-5 * altM, 5.25588);
        this.processBarometerReading(simHpa, false);
      }, 50);
    } else {
      if (this.simTimer) {
        clearInterval(this.simTimer);
        this.simTimer = null;
      }
    }
  }

  // Interactive touch/mouse manual tilt for testing without phone
  public applyManualOffset(deltaPitch: number, deltaRoll: number): void {
    if (!this.isSimulated) {
      this.currentOrientation.pitch = Math.max(-85, Math.min(85, this.currentOrientation.pitch + deltaPitch));
      this.currentOrientation.roll = Math.max(-85, Math.min(85, this.currentOrientation.roll + deltaRoll));
      this.currentOrientation.calibratedPitch = this.currentOrientation.pitch - this.pitchOffset;
      this.currentOrientation.calibratedRoll = this.currentOrientation.roll - this.rollOffset;
      this.orientationListeners.forEach((fn) => fn(this.currentOrientation));
    }
  }

  // Subscriptions
  public onOrientation(fn: (data: OrientationData) => void): () => void {
    this.orientationListeners.push(fn);
    fn(this.currentOrientation);
    return () => {
      this.orientationListeners = this.orientationListeners.filter((f) => f !== fn);
    };
  }

  public onMotion(fn: (data: MotionData) => void): () => void {
    this.motionListeners.push(fn);
    fn(this.currentMotion);
    return () => {
      this.motionListeners = this.motionListeners.filter((f) => f !== fn);
    };
  }

  public onBarometer(fn: (data: BarometerData) => void): () => void {
    this.barometerListeners.push(fn);
    fn(this.currentBarometer);
    return () => {
      this.barometerListeners = this.barometerListeners.filter((f) => f !== fn);
    };
  }

  public onGps(fn: (data: GpsData) => void): () => void {
    this.gpsListeners.push(fn);
    fn(this.currentGps);
    return () => {
      this.gpsListeners = this.gpsListeners.filter((f) => f !== fn);
    };
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }
}

export const sensorManager = new SensorManager();
