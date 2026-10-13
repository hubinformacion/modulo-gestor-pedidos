"use client";
import { sileo, type SileoOptions } from "sileo";
export type ActionOutcome = { success: boolean; message?: string };
type Copy = { title: string; description: string };
type ActionCopy<T> = {
  loading: Copy;
  success: Copy | ((result: T) => Copy);
  error: Copy;
  action?: SileoOptions | ((result: T) => SileoOptions);
};
class ActionRejected extends Error {}
// A Server Action resolving { success:false } is not a successful promise.
// Execute once, preserve the original result for inline errors, and never
// attach a retry button that could repeat a business mutation.
export async function notifyAction<T extends ActionOutcome>(operation: () => Promise<T>, copy: ActionCopy<T>): Promise<T> {
  let rejected: T | undefined;
  const checked = Promise.resolve().then(operation).then((result) => {
    if (!result.success) { rejected = result; throw new ActionRejected(result.message || copy.error.description); }
    return result;
  });
  const notification = sileo.promise(checked, {
    loading: copy.loading,
    success: copy.success,
    error: (error: unknown) => ({ title: copy.error.title, description: error instanceof ActionRejected ? error.message : copy.error.description, duration: 8000 }),
    ...(copy.action ? { action: copy.action } : {}),
  });
  try { return await notification; }
  catch (error) { if (rejected) return rejected; throw error; }
}
