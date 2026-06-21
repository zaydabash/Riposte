import pytest

from src.config import Settings
from src.core.models import RemediationTask
from src.services.remediation_engine import RemediationEngine, route_to_file_candidates
from src.workers.patch_worker import RemediationRunner, extract_repo_full_name


def test_extract_repo_full_name():
    assert (
        extract_repo_full_name("https://github.com/example/app.git")
        == "example/app"
    )


def test_route_to_file_candidates_prefers_frontend_app():
    candidates = route_to_file_candidates("https://target.example.com/portal")
    assert candidates[0] == "frontend/app/portal/page.tsx"
    assert "src/app/portal/page.tsx" in candidates


def test_route_to_file_candidates_nested_path():
    candidates = route_to_file_candidates("https://target.example.com/admin/users")
    assert candidates[0] == "frontend/app/admin/users/page.tsx"
    assert "app/admin/users/page.tsx" in candidates


@pytest.mark.asyncio
async def test_remediation_runner_opens_issue_for_target_route():
    class FakeGitHub:
        async def create_issue(
            self,
            repo_full_name,
            title,
            body,
            evidence_hud_link=None,
        ):
            assert repo_full_name == "example/app"
            assert "T1566" in title
            assert "credential leak" in body
            return "https://github.com/example/app/issues/1"

    runner = RemediationRunner(
        Settings(MINIMAX_API_KEY="minimax-test", GITHUB_TOKEN="github-test")
    )
    fake_github = FakeGitHub()
    runner._github = fake_github

    result = await runner.run(
        RemediationTask(
            audit_id="audit-1",
            repo_url="https://github.com/example/app",
            target_url="https://target.example.com/portal",
            payload="credential leak",
            aries_score=91.2,
            technique_id="T1566",
        )
    )

    assert result.status == "issue_created"
    assert result.issue_url == "https://github.com/example/app/issues/1"
    assert result.target_url == "https://target.example.com/portal"


@pytest.mark.asyncio
async def test_remediation_engine_calls_minimax():
    class FakeCompletion:
        def __init__(self, content: str):
            self.choices = [type("Choice", (), {"message": type("Msg", (), {"content": content})()})()]

    class FakeMiniMax:
        class chat:
            class completions:
                @staticmethod
                async def create(**kwargs):
                    assert kwargs["model"] == "MiniMax-M3"
                    return FakeCompletion("```tsx\nexport const fixed = true;\n```")

    engine = RemediationEngine(
        Settings(MINIMAX_API_KEY="key", MINIMAX_MODEL="MiniMax-M3"),
        FakeMiniMax(),
    )
    fixed = await engine.generate_fix(
        error_log="control failed",
        code_snippet="export const broken = true;",
        file_path="frontend/app/portal/page.tsx",
    )
    assert fixed == "export const fixed = true;"
