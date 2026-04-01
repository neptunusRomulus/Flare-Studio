import type { MapObject } from '../types';

type PropertyType =
  | 'int'
  | 'float'
  | 'bool'
  | 'filename'
  | 'duration'
  | 'intPair'
  | 'floatPair'
  | 'direction'
  | 'point'
  | 'predefined'
  | 'list'
  | 'string';

interface PropertySpec {
  type: PropertyType;
  min?: number;
  max?: number;
  options?: string[];
}

const CARDINAL_DIRECTIONS = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
const BOOLEAN_STRINGS = new Set(['true', 'false', '1', '0']);

// Property specs for NPCs and enemies (left empty for now).
const ENEMY_PROPERTY_SPECS: Record<string, PropertySpec> = {};
const NPC_PROPERTY_SPECS: Record<string, PropertySpec> = {};

const validateValue = (key: string, trimmed: string, spec: PropertySpec): string | null => {
  switch (spec.type) {
    case 'int': {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) return `${key} must be an integer.`;
      if (spec.min !== undefined && parsed < spec.min) return `${key} must be greater than or equal to ${spec.min}.`;
      if (spec.max !== undefined && parsed > spec.max) return `${key} must be less than or equal to ${spec.max}.`;
      return null;
    }
    case 'float': {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isNaN(parsed)) return `${key} must be a number.`;
      if (spec.min !== undefined && parsed < spec.min) return `${key} must be greater than or equal to ${spec.min}.`;
      if (spec.max !== undefined && parsed > spec.max) return `${key} must be less than or equal to ${spec.max}.`;
      return null;
    }
    case 'bool': {
      if (!BOOLEAN_STRINGS.has(trimmed.toLowerCase())) return `${key} must be true or false.`;
      return null;
    }
    case 'filename': {
      if (!trimmed) return `${key} cannot be empty.`;
      return null;
    }
    case 'duration': {
      if (!/^\d+(ms|s)?$/i.test(trimmed)) return `${key} must be a duration such as 200ms or 2s.`;
      return null;
    }
    case 'intPair': {
      const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 2) return `${key} must contain one or two comma-separated integers.`;
      for (const part of parts) {
        if (!/^-?\d+$/.test(part)) return `${key} must contain valid integers.`;
        const parsed = Number.parseInt(part, 10);
        if (spec.min !== undefined && parsed < spec.min) return `${key} values must be greater than or equal to ${spec.min}.`;
        if (spec.max !== undefined && parsed > spec.max) return `${key} values must be less than or equal to ${spec.max}.`;
      }
      return null;
    }
    case 'floatPair': {
      const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 2) return `${key} must contain one or two comma-separated numbers.`;
      for (const part of parts) {
        const parsed = Number.parseFloat(part);
        if (Number.isNaN(parsed)) return `${key} must contain valid numbers.`;
        if (spec.min !== undefined && parsed < spec.min) return `${key} values must be greater than or equal to ${spec.min}.`;
        if (spec.max !== undefined && parsed > spec.max) return `${key} values must be less than or equal to ${spec.max}.`;
      }
      return null;
    }
    case 'direction': {
      const upper = trimmed.toUpperCase();
      if (CARDINAL_DIRECTIONS.has(upper)) return null;
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 7) return null;
      return `${key} must be a direction (N, NE, ... , NW) or a number between 0 and 7.`;
    }
    case 'point': {
      const parts = trimmed.split(',').map(p => p.trim());
      if (parts.length !== 2 || !parts.every(part => /^-?\d+$/.test(part))) return `${key} must be two comma-separated integers.`;
      return null;
    }
    case 'predefined': {
      if (spec.options && !spec.options.includes(trimmed)) return `${key} must be one of: ${spec.options.join(', ')}.`;
      return null;
    }
    case 'list':
    case 'string':
    default:
      return null;
  }
};

const validateAndSanitizeObject = (
  object: MapObject
): { errors: string[]; sanitized: Record<string, string> } => {
  const specs = object.type === 'enemy' ? ENEMY_PROPERTY_SPECS
    : object.type === 'npc' ? NPC_PROPERTY_SPECS
    : {};

  const sanitized: Record<string, string> = {};
  const errors: string[] = [];
  const properties = object.properties || {};

  for (const [key, rawValue] of Object.entries(properties)) {
    const value = (rawValue ?? '').toString();
    const trimmed = value.trim();
    const spec = specs[key];

    if (spec) {
      const error = validateValue(key, trimmed, spec);
      if (error) {
        errors.push(error);
      }
      if (spec.type === 'bool') {
        sanitized[key] = trimmed.toLowerCase();
      } else if (spec.type === 'direction' && CARDINAL_DIRECTIONS.has(trimmed.toUpperCase())) {
        sanitized[key] = trimmed.toUpperCase();
      } else {
        sanitized[key] = trimmed;
      }
    } else {
      sanitized[key] = trimmed;
    }
  }

  // Remove empty-string properties (activated but never filled in)
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] === '') delete sanitized[key];
  }

  return { errors, sanitized };
};

export type { PropertyType, PropertySpec };
export { ENEMY_PROPERTY_SPECS, NPC_PROPERTY_SPECS, validateAndSanitizeObject };
