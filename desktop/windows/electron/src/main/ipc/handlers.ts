import { registerDialogHandlers } from './dialog';
import { registerAppInfoHandlers } from './app-info';
import { registerServiceHandlers, setProcessManagerRef } from './service';
import { registerAssistantHandlers, setAssistantManagerRef } from './assistant';

export { setProcessManagerRef } from './service';
export { setAssistantManagerRef } from './assistant';

export function registerAllIPCHandlers(): void {
  registerDialogHandlers();
  registerAppInfoHandlers();
  registerServiceHandlers();
  registerAssistantHandlers();
}
