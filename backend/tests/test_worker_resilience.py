import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.config import Settings
from src.core.models import AttackTask, RemediationTask, ScenarioTask
from src.workers.offensive_worker import offensive_worker
from src.workers.patch_worker import patch_worker
from src.workers.verification_worker import VerificationRunner, verification_worker

_OFFLINE = Settings(EMBEDDING_DIM=256, MINIMAX_API_KEY=None)


@pytest.mark.asyncio
async def test_verification_worker_enqueues_error_on_runner_failure():
    verify_queue: asyncio.Queue = asyncio.Queue()
    eval_queue: asyncio.Queue = asyncio.Queue()
    shutdown = asyncio.Event()

    task = ScenarioTask(
        audit_id="a1",
        technique_id="T1185",
        target_url="https://target.example.com",
        repo_url="https://github.com/org/repo",
    )
    await verify_queue.put(task)
    await verify_queue.put(None)

    runner = MagicMock(spec=VerificationRunner)
    runner._settings = _OFFLINE
    runner.run = AsyncMock(side_effect=RuntimeError("boom"))

    worker = asyncio.create_task(
        verification_worker(
            verify_queue,
            eval_queue,
            runner,
            asyncio.Semaphore(1),
            shutdown,
        )
    )
    await worker

    result = await eval_queue.get()
    assert result.verification_status == "error"
    assert "boom" in (result.error or "")


@pytest.mark.asyncio
async def test_offensive_worker_enqueues_error_on_executor_failure():
    attack_queue: asyncio.Queue = asyncio.Queue()
    eval_queue: asyncio.Queue = asyncio.Queue()
    shutdown = asyncio.Event()

    task = AttackTask(
        audit_id="a1",
        target_url="https://target.example.com",
        payload="probe",
        repo_url="https://github.com/org/repo",
    )
    await attack_queue.put(task)
    await attack_queue.put(None)

    executor = MagicMock()
    executor._settings = _OFFLINE
    executor.execute = AsyncMock(side_effect=RuntimeError("attack failed"))

    worker = asyncio.create_task(
        offensive_worker(
            attack_queue,
            eval_queue,
            executor,
            asyncio.Semaphore(1),
            shutdown,
        )
    )
    await worker

    result = await eval_queue.get()
    assert result.error is not None
    assert "attack failed" in result.error


@pytest.mark.asyncio
async def test_patch_worker_records_error_on_runner_failure():
    remediation_queue: asyncio.Queue = asyncio.Queue()
    shutdown = asyncio.Event()
    recorded = []

    task = RemediationTask(
        audit_id="a1",
        repo_url="https://github.com/org/repo",
        target_url="https://target.example.com",
        payload="leak",
        aries_score=90.0,
        technique_id="T1185",
    )
    await remediation_queue.put(task)
    await remediation_queue.put(None)

    runner = MagicMock()
    runner._settings = _OFFLINE
    runner.run = AsyncMock(side_effect=RuntimeError("patch failed"))

    async def on_remediation(result):
        recorded.append(result)

    worker = asyncio.create_task(
        patch_worker(remediation_queue, runner, on_remediation, shutdown)
    )
    await worker

    assert len(recorded) == 1
    assert recorded[0].status == "error"
    assert "patch failed" in (recorded[0].detail or "")
