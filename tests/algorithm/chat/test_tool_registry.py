import unittest

from lazyllm.tools.agent.toolsManager import ToolManager

from lazymind.chat.service.component.tool_registry import DEFAULT_TOOLS, filter_tools


class ToolRegistryTest(unittest.TestCase):
    def test_default_active_tools_are_agent_compatible(self):
        tools = [cfg.instance for cfg in filter_tools(DEFAULT_TOOLS)]

        ToolManager(tools)


if __name__ == "__main__":
    unittest.main()
