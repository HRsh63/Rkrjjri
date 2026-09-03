export interface OrientationData {
  pitch: number; // Beta: -180 to 180 degrees (tilt front/back)
  roll: number;  // Gamma: -90 to 90 degrees (tilt left/right)
  yaw: number;   // Alpha: 0 to 360 degrees (compass direction)
  absolute: boolean;
  calibratedPitch: number;
  calibratedRoll: number;
  calibratedYaw: number;
}

export interface MotionData {
  // Linear acceleration in m/s^2 without gravity
  accX: number;
  accY: number;
  accZ: number;
  
  // Acceleration including gravity (m/s^2)
  gravityX: number;
  gravityY: number;
  gravityZ: number;
  
  // Total G-force (1.0 = normal earth gravity at rest)
  totalG: number;
  maxG: number;
  minG: number;
  
  // Gyroscope rotation rates in degrees per second
  rotRateAlpha: number; // Yaw rate (Z-axis)
  rotRateBeta: number;  // Pitch rate (X-axis)
  rotRateGamma: number; // Roll rate (Y-axis)
  
  interval: number; // ms
}

export interface BarometerData {
  pressureHpa: number;       // Hectopascals / millibars (standard sea level: ~1013.25)
  pressureInHg: number;      // Inches of mercury (standard: ~29.92)
  altitudeM: number;         // Barometric altitude in meters
  altitudeFt: number;        // Barometric altitude in feet
  relativeAltitudeM: number; // Delta from zero/tare point
  verticalSpeedMps: number;  // Rate of climb / sink (m/s)
  verticalSpeedFpm: number;  // Rate of climb / sink (ft/min)
  seaLevelRefHpa: number;    // QNH reference pressure (default 1013.25)
  isHardwareNative: boolean; // True if using actual AmbientPressureSensor
  sensorStatus: 'active' | 'emulated' | 'estimating' | 'unsupported';
}

export interface GpsData {
  latitude: number | null;
  longitude: number | null;
  altitudeGpsM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  available: boolean;
}

export type HudTheme = 'cyan' | 'green' | 'amber' | 'white';

export interface HudSettings {
  theme: HudTheme;
  showHorizonLadder: boolean;
  showGForceBall: boolean;
  showVariometer: boolean;
  showCompassRibbon: boolean;
  showGpsCoordinates: boolean;
  unitSystem: 'metric' | 'imperial';
  altitudeSource: 'barometer' | 'gps';
  simulatedSensors: boolean;
  reticleStyle: 'fighter' | 'drone' | 'crosshair' | 'minimal';
}
