import { ERROR_CODES } from "./error-codes";
import { failure, success, type DeterministicResponse, type ExecutionMode } from "./contracts";

export interface BoundedLoopOptions<TState> {
  mode: ExecutionMode;
  maxSteps: number;
  initialState: TState;
  step: (state: TState, index: number) => TState;
  isConverged: (state: TState, index: number) => boolean;
  traceId?: string;
}

export interface BoundedLoopResult<TState> {
  finalState: TState;
  converged: boolean;
  stepsExecuted: number;
}

export function runBoundedLoop<TState>(
  options: BoundedLoopOptions<TState>
): DeterministicResponse<BoundedLoopResult<TState>> {
  if (!Number.isInteger(options.maxSteps) || options.maxSteps <= 0) {
    return failure(
      {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "maxSteps must be a positive integer",
        retryable: false,
      },
      { mode: options.mode }
    );
  }

  let state = options.initialState;

  for (let i = 0; i < options.maxSteps; i += 1) {
    if (options.isConverged(state, i)) {
      return success(
        {
          finalState: state,
          converged: true,
          stepsExecuted: i,
        },
        {
          mode: options.mode,
          stepCount: i,
          traceId: options.traceId,
        }
      );
    }

    state = options.step(state, i);
  }

  return failure(
    {
      code: ERROR_CODES.EXECUTION_CONVERGENCE_FAILED,
      message: "Bounded execution terminated before convergence",
      retryable: false,
    },
    {
      mode: options.mode,
      stepCount: options.maxSteps,
      traceId: options.traceId,
    }
  );
}