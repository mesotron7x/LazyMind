export const IPC_CHANNELS = {
  'datadir:get': 'datadir:get',
  'dialog:pickFolder': 'dialog:pickFolder',
  'shell:openPath': 'shell:openPath',
  'diagnostics:export': 'diagnostics:export',
  'diagnostics:openLogDir': 'diagnostics:openLogDir',
  'service:getStatus': 'service:getStatus',
  'service:getAllStatus': 'service:getAllStatus',
  'assistant:getCurrent': 'assistant:getCurrent',
  'assistant:setCurrent': 'assistant:setCurrent',
  'assistant:getList': 'assistant:getList',
  'app:getVersion': 'app:getVersion',
  'app:isPackaged': 'app:isPackaged',
  'app:getMode': 'app:getMode',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
