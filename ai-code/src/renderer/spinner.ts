// ============================================================
// ai-code - Terminal Spinner / Loading Animation
//
// Pure ASCII spinner animation (no Unicode characters).
// Uses simple rotating characters: - \ | /
// ============================================================

/**
 * Frames for the spinner animation.
 * Pure ASCII: - \ | /
 */
const FRAMES = ['-', '\\', '|', '/'];

/**
 * Direction of rotation (true = forward, false = reverse).
 */
let _direction = true;

/**
 * Get the next frame index.
 */
let _frameIndex = 0;

function nextFrame(): string {
  if (_direction) {
    _frameIndex = (_frameIndex + 1) % FRAMES.length;
  } else {
    _frameIndex = (_frameIndex - 1 + FRAMES.length) % FRAMES.length;
  }
  return FRAMES[_frameIndex] ?? '-';
}

/**
 * Create a spinner controller.
 * Uses ASCII-only characters for the animation.
 */
export function createSpinner() {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let text = '';

  /**
   * Start the spinner with a message.
   */
  function start(message: string = 'Processing...'): void {
    stop();
    text = message;

    // Write initial frame
    process.stdout.write('\r' + '  ' + nextFrame() + ' ' + text);

    intervalId = setInterval(() => {
      process.stdout.write('\r' + '  ' + nextFrame() + ' ' + text);
    }, 120);
  }

  /**
   * Stop the spinner and clear the line.
   */
  function stop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // Clear the spinner line
    process.stdout.write('\r' + ' '.repeat(process.stdout.columns ?? 80) + '\r');
  }

  /**
   * Update the spinner message.
   */
  function setMessage(message: string): void {
    text = message;
    if (intervalId !== null) {
      process.stdout.write('\r' + '  ' + nextFrame() + ' ' + text);
    }
  }

  /**
   * Complete the spinner with a success message.
   */
  function succeed(message?: string): void {
    const msg = message ?? 'Done.';
    stop();
    console.log('  ' + '[OK]' + ' ' + msg);
  }

  /**
   * Complete the spinner with a failure message.
   */
  function fail(message?: string): void {
    const msg = message ?? 'Failed.';
    stop();
    console.log('  ' + '[FAIL]' + ' ' + msg);
  }

  return { start, stop, setMessage, succeed, fail };
}

export type Spinner = ReturnType<typeof createSpinner>;
