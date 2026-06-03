import { registerDialogHandlers } from './dialog';
import { registerAppInfoHandlers } from './app-info';
import { registerServiceHandlers, setProcessManagerRef } from './service';

export { setProcessManagerRef } from './service';

export function registerAllIPCHandlers(): void {
  registerDialogHandlers();
  registerAppInfoHandlers();
  registerServiceHandlers();
}
