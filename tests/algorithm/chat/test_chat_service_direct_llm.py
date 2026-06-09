import asyncio

from lazymind.chat.service import chat_service


async def _collect_streaming_response(response):
    chunks = []
    async for chunk in response.body_iterator:
        if isinstance(chunk, bytes):
            chunk = chunk.decode('utf-8')
        chunks.append(chunk)
    return ''.join(chunks)


def test_handle_chat_uses_llm_directly_without_tools_or_skills(monkeypatch):
    helper_calls = []
    agent_calls = []

    class FakeFuture:
        def result(self):
            return {'content': 'Hello there'}

    class FakeHelper:
        def __init__(self, impl, **kwargs):
            helper_calls.append({'impl': impl, 'kwargs': kwargs})
            self.future = FakeFuture()

        async def astream(self, query, llm_chat_history=None):
            yield {'tag': 'text', 'delta': 'Hello'}
            yield {'tag': 'text', 'delta': 'there'}

    class FakeAgent:
        def __init__(self, *args, **kwargs):
            agent_calls.append({'args': args, 'kwargs': kwargs})

    fake_llm = object()
    monkeypatch.setattr(chat_service, 'AutoModel', lambda model, config=False: fake_llm)
    monkeypatch.setattr(chat_service.lazyllm.tools.agent, 'ReactAgent', FakeAgent)
    monkeypatch.setattr(chat_service.lazyllm.module.stream_helper, 'StreamCallHelper', FakeHelper)

    async def drive():
        response = await chat_service.handle_chat(
            query='hello',
            history=[],
            session_id='sid-direct-llm',
            filters={},
            files=None,
            databases=None,
            priority=None,
            available_tools=[],
            available_skills=[],
            memory=None,
            user_preference=None,
            use_memory=False,
            model_config={'llm': {'source': 'siliconflow', 'model': 'Qwen/Qwen2.5-14B-Instruct'}},
        )
        return await _collect_streaming_response(response)

    body = asyncio.run(drive())

    assert not agent_calls
    assert helper_calls
    assert helper_calls[0]['impl'] is fake_llm
    assert helper_calls[0]['kwargs']['init_sid'] is False
    assert 'Hello there' in body
    assert 'Hellothere' not in body
    assert '"status": "FINISHED"' in body
