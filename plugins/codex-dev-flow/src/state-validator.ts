import { Ajv2020 } from "ajv/dist/2020.js";
import stateSchema from "../schemas/state.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(stateSchema);
export interface StateValidationResult {
  valid: boolean;
  errors: readonly unknown[];
}
export function validateStateV4(value: unknown): StateValidationResult {
  const valid = validate(value);
  return { valid, errors: validate.errors ? [...validate.errors] : [] };
}
