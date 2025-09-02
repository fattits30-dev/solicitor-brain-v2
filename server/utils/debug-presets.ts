import { DebugLogger } from './debug.js';

export interface DebugPreset {
  id: string;
  name: string;
  description: string;
  settings: {
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
    categories?: string[];
    enableQueryLogging?: boolean;
    enablePerformanceLogging?: boolean;
    enableNetworkLogging?: boolean;
    autoRecord?: boolean;
  };
  triggers?: {
    onError?: boolean;
    onSlowQuery?: number; // Threshold in ms
    onSlowRequest?: number; // Threshold in ms
    onMemoryThreshold?: number; // Threshold in MB
  };
}

export class DebugPresetManager {
  private static presets: Map<string, DebugPreset> = new Map();
  private static activePreset: string | null = null;
  private static originalSettings: any = {};

  static {
    // Initialize default presets
    this.registerDefaultPresets();
  }

  private static registerDefaultPresets() {
    // Production-like preset
    this.register({
      id: 'production',
      name: 'Production Mode',
      description: 'Minimal logging, only errors and warnings',
      settings: {
        level: 'WARN',
        enableQueryLogging: false,
        enablePerformanceLogging: false,
        enableNetworkLogging: false,
        autoRecord: false
      }
    });

    // Performance debugging preset
    this.register({
      id: 'performance',
      name: 'Performance Analysis',
      description: 'Focus on performance metrics and slow operations',
      settings: {
        level: 'INFO',
        categories: ['PERFORMANCE', 'DATABASE', 'API_RESPONSE'],
        enableQueryLogging: true,
        enablePerformanceLogging: true,
        enableNetworkLogging: true,
        autoRecord: false
      },
      triggers: {
        onSlowQuery: 100, // Log queries over 100ms
        onSlowRequest: 500, // Log requests over 500ms
      }
    });

    // Database debugging preset
    this.register({
      id: 'database',
      name: 'Database Debugging',
      description: 'Detailed database query logging',
      settings: {
        level: 'DEBUG',
        categories: ['DATABASE'],
        enableQueryLogging: true,
        enablePerformanceLogging: true,
        enableNetworkLogging: false,
        autoRecord: false
      },
      triggers: {
        onSlowQuery: 50,
        onError: true
      }
    });

    // API debugging preset
    this.register({
      id: 'api',
      name: 'API Debugging',
      description: 'Track all API requests and responses',
      settings: {
        level: 'DEBUG',
        categories: ['API_REQUEST', 'API_RESPONSE', 'AUTH'],
        enableQueryLogging: false,
        enablePerformanceLogging: true,
        enableNetworkLogging: true,
        autoRecord: false
      },
      triggers: {
        onSlowRequest: 1000,
        onError: true
      }
    });

    // Authentication debugging preset
    this.register({
      id: 'auth',
      name: 'Authentication Debugging',
      description: 'Debug authentication and authorization issues',
      settings: {
        level: 'TRACE',
        categories: ['AUTH', 'SECURITY', 'SESSION'],
        enableQueryLogging: true,
        enablePerformanceLogging: false,
        enableNetworkLogging: true,
        autoRecord: true
      },
      triggers: {
        onError: true
      }
    });

    // Memory debugging preset
    this.register({
      id: 'memory',
      name: 'Memory Analysis',
      description: 'Monitor memory usage and detect leaks',
      settings: {
        level: 'INFO',
        categories: ['MEMORY', 'PERFORMANCE'],
        enableQueryLogging: false,
        enablePerformanceLogging: true,
        enableNetworkLogging: false,
        autoRecord: true
      },
      triggers: {
        onMemoryThreshold: 500, // Alert if heap > 500MB
        onError: true
      }
    });

    // Full debugging preset
    this.register({
      id: 'full',
      name: 'Full Debug Mode',
      description: 'Everything enabled - maximum verbosity',
      settings: {
        level: 'TRACE',
        enableQueryLogging: true,
        enablePerformanceLogging: true,
        enableNetworkLogging: true,
        autoRecord: true
      },
      triggers: {
        onError: true,
        onSlowQuery: 10,
        onSlowRequest: 100,
        onMemoryThreshold: 100
      }
    });

    // Error investigation preset
    this.register({
      id: 'error-investigation',
      name: 'Error Investigation',
      description: 'Automatically start recording on errors',
      settings: {
        level: 'DEBUG',
        categories: ['ERROR', 'SECURITY'],
        enableQueryLogging: true,
        enablePerformanceLogging: true,
        enableNetworkLogging: true,
        autoRecord: true
      },
      triggers: {
        onError: true
      }
    });

    // Development preset
    this.register({
      id: 'development',
      name: 'Development Mode',
      description: 'Balanced logging for development',
      settings: {
        level: 'DEBUG',
        enableQueryLogging: true,
        enablePerformanceLogging: true,
        enableNetworkLogging: true,
        autoRecord: false
      }
    });

    // Minimal preset
    this.register({
      id: 'minimal',
      name: 'Minimal Logging',
      description: 'Bare minimum - errors only',
      settings: {
        level: 'ERROR',
        enableQueryLogging: false,
        enablePerformanceLogging: false,
        enableNetworkLogging: false,
        autoRecord: false
      }
    });
  }

  static register(preset: DebugPreset) {
    this.presets.set(preset.id, preset);
    DebugLogger.debug(`Registered debug preset: ${preset.name}`, preset, 'PRESETS');
  }

  static activate(presetId: string): boolean {
    const preset = this.presets.get(presetId);
    if (!preset) {
      DebugLogger.error(`Debug preset not found: ${presetId}`, undefined, 'PRESETS');
      return false;
    }

    // Save current settings
    if (!this.activePreset) {
      this.originalSettings = {
        level: DebugLogger.getLevel(),
        enableQueryLogging: process.env.ENABLE_QUERY_LOGGING,
        enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING,
        enableNetworkLogging: process.env.ENABLE_NETWORK_LOGGING,
      };
    }

    // Apply preset settings
    DebugLogger.setLevel(preset.settings.level);
    
    if (preset.settings.enableQueryLogging !== undefined) {
      process.env.ENABLE_QUERY_LOGGING = preset.settings.enableQueryLogging.toString();
    }
    
    if (preset.settings.enablePerformanceLogging !== undefined) {
      process.env.ENABLE_PERFORMANCE_LOGGING = preset.settings.enablePerformanceLogging.toString();
    }
    
    if (preset.settings.enableNetworkLogging !== undefined) {
      process.env.ENABLE_NETWORK_LOGGING = preset.settings.enableNetworkLogging.toString();
    }

    this.activePreset = presetId;
    
    // Set up triggers if defined
    if (preset.triggers) {
      this.setupTriggers(preset);
    }

    DebugLogger.info(`Activated debug preset: ${preset.name}`, preset.settings, 'PRESETS');
    
    return true;
  }

  static deactivate() {
    if (!this.activePreset) {
      return;
    }

    // Restore original settings
    if (this.originalSettings.level) {
      DebugLogger.setLevel(this.originalSettings.level);
    }
    
    if (this.originalSettings.enableQueryLogging !== undefined) {
      process.env.ENABLE_QUERY_LOGGING = this.originalSettings.enableQueryLogging;
    }
    
    if (this.originalSettings.enablePerformanceLogging !== undefined) {
      process.env.ENABLE_PERFORMANCE_LOGGING = this.originalSettings.enablePerformanceLogging;
    }
    
    if (this.originalSettings.enableNetworkLogging !== undefined) {
      process.env.ENABLE_NETWORK_LOGGING = this.originalSettings.enableNetworkLogging;
    }

    const previousPreset = this.activePreset;
    this.activePreset = null;
    
    DebugLogger.info(`Deactivated debug preset: ${previousPreset}`, undefined, 'PRESETS');
  }

  private static setupTriggers(preset: DebugPreset) {
    if (!preset.triggers) return;

    // Monitor for errors
    if (preset.triggers.onError) {
      process.on('uncaughtException', (error) => {
        DebugLogger.error('Uncaught exception detected - preset trigger activated', error, 'PRESETS');
        // Could start recording here
      });

      process.on('unhandledRejection', (reason, promise) => {
        DebugLogger.error('Unhandled rejection detected - preset trigger activated', { reason, promise }, 'PRESETS');
        // Could start recording here
      });
    }

    // Monitor memory if threshold is set
    if (preset.triggers.onMemoryThreshold) {
      const threshold = preset.triggers.onMemoryThreshold * 1024 * 1024; // Convert MB to bytes
      
      setInterval(() => {
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > threshold) {
          DebugLogger.warn(`Memory threshold exceeded: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB > ${preset.triggers.onMemoryThreshold}MB`, 
            memUsage, 'PRESETS');
        }
      }, 10000); // Check every 10 seconds
    }
  }

  static getPresets(): DebugPreset[] {
    return Array.from(this.presets.values());
  }

  static getActivePreset(): DebugPreset | null {
    return this.activePreset ? this.presets.get(this.activePreset) || null : null;
  }

  static getPreset(id: string): DebugPreset | undefined {
    return this.presets.get(id);
  }

  static exportPreset(id: string): string | null {
    const preset = this.presets.get(id);
    if (!preset) return null;
    
    return JSON.stringify(preset, null, 2);
  }

  static importPreset(presetJson: string): boolean {
    try {
      const preset = JSON.parse(presetJson) as DebugPreset;
      this.register(preset);
      return true;
    } catch (error) {
      DebugLogger.error('Failed to import preset', error, 'PRESETS');
      return false;
    }
  }

  // Quick presets for common scenarios
  static quickDebug() {
    this.activate('development');
  }

  static quickPerformance() {
    this.activate('performance');
  }

  static quickDatabase() {
    this.activate('database');
  }

  static quickAPI() {
    this.activate('api');
  }

  static quickAuth() {
    this.activate('auth');
  }

  static quickMinimal() {
    this.activate('minimal');
  }

  static quickFull() {
    this.activate('full');
  }
}

// Export convenience functions
export const activatePreset = (id: string) => DebugPresetManager.activate(id);
export const deactivatePreset = () => DebugPresetManager.deactivate();
export const getPresets = () => DebugPresetManager.getPresets();
export const getActivePreset = () => DebugPresetManager.getActivePreset();