"""Async GitHub API client for automated PR creation."""

import base64
import logging
from typing import Optional

import httpx

from src.config import Settings

logger = logging.getLogger(__name__)


class GitHubClient:
    def __init__(self, settings: Settings) -> None:
        self._token = settings.github_token
        self._headers = {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        } if self._token else {}

    def _get_base_url(self, repo_full_name: str) -> str:
        # e.g., "owner/repo"
        return f"https://api.github.com/repos/{repo_full_name}"

    async def get_file_content(self, repo_full_name: str, file_path: str, branch: str) -> Optional[str]:
        """Fetch file content from GitHub API."""
        if not self._token:
            raise RuntimeError("GitHub token is not configured.")
        base_url = f"{self._get_base_url(repo_full_name)}/contents/{file_path}"
        async with httpx.AsyncClient() as client:
            r = await client.get(base_url, headers=self._headers, params={"ref": branch})
            if r.status_code == 200:
                data = r.json()
                if "content" in data:
                    return base64.b64decode(data["content"]).decode("utf-8")
            return None

    async def get_default_branch(self, repo_full_name: str) -> str:
        """Get the default branch of the repository."""
        if not self._token:
            raise RuntimeError("GitHub token is not configured.")
        base_url = self._get_base_url(repo_full_name)
        async with httpx.AsyncClient() as client:
            r = await client.get(base_url, headers=self._headers)
            if r.status_code == 200:
                return r.json().get("default_branch", "main")
            return "main"

    async def create_branch_and_commit(
        self,
        repo_full_name: str,
        base_branch: str,
        new_branch: str,
        file_path: str,
        new_content: str,
        commit_message: str,
    ) -> str:
        """Create a new branch from base, update one file with new content, and commit."""
        if not self._token:
            raise RuntimeError("GitHub token is not configured.")
        base_url = self._get_base_url(repo_full_name)
        
        async with httpx.AsyncClient() as client:
            # 1. Get SHA of base_branch
            r = await client.get(f"{base_url}/git/ref/heads/{base_branch}", headers=self._headers)
            r.raise_for_status()
            base_sha = r.json()["object"]["sha"]

            # 2. Create the new branch
            payload = {"ref": f"refs/heads/{new_branch}", "sha": base_sha}
            r = await client.post(f"{base_url}/git/refs", headers=self._headers, json=payload)
            if r.status_code != 201:
                logger.warning("Branch creation status %s: %s", r.status_code, r.text)

            # 3. Commit file
            encoded = base64.b64encode(new_content.encode()).decode()
            
            # Check if the file already exists (need its SHA to update it)
            existing_sha = None
            r = await client.get(f"{base_url}/contents/{file_path}", headers=self._headers, params={"ref": new_branch})
            if r.status_code == 200:
                existing_sha = r.json()["sha"]

            commit_payload = {
                "message": commit_message,
                "content": encoded,
                "branch": new_branch
            }
            if existing_sha:
                commit_payload["sha"] = existing_sha

            r = await client.put(f"{base_url}/contents/{file_path}", headers=self._headers, json=commit_payload)
            r.raise_for_status()

            return f"refs/heads/{new_branch}"

    async def open_pull_request(
        self,
        repo_full_name: str,
        base_branch: str,
        head_branch: str,
        title: str,
        body: str,
        evidence_screenshot_url: Optional[str] = None,
        evidence_hud_link: Optional[str] = None,
    ) -> str:
        """Open a PR from head_branch to base_branch with title and body."""
        if not self._token:
            raise RuntimeError("GitHub token is not configured.")
        base_url = self._get_base_url(repo_full_name)

        description = body
        if evidence_screenshot_url or evidence_hud_link:
            description += "\n\n---\n**Evidence**\n"
            if evidence_screenshot_url:
                description += f"\n- Screenshot: {evidence_screenshot_url}\n"
            if evidence_hud_link:
                description += f"\n- HUD / session: {evidence_hud_link}\n"

        payload = {
            "title": title,
            "head": head_branch,
            "base": base_branch,
            "body": description,
        }
        
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{base_url}/pulls", headers=self._headers, json=payload)
            r.raise_for_status()
            pr = r.json()
            return pr["html_url"]

    async def create_fix_pr(
        self,
        repo_full_name: str,
        base_branch: str,
        fix_branch_name: str,
        file_path: str,
        patched_content: str,
        pr_title: str,
        pr_body: str,
        evidence_screenshot_url: Optional[str] = None,
        evidence_hud_link: Optional[str] = None,
    ) -> str:
        """Full flow: create branch, commit patched file, open PR with evidence."""
        await self.create_branch_and_commit(
            repo_full_name=repo_full_name,
            base_branch=base_branch,
            new_branch=fix_branch_name,
            file_path=file_path,
            new_content=patched_content,
            commit_message=pr_title,
        )
        return await self.open_pull_request(
            repo_full_name=repo_full_name,
            base_branch=base_branch,
            head_branch=fix_branch_name,
            title=pr_title,
            body=pr_body,
            evidence_screenshot_url=evidence_screenshot_url,
            evidence_hud_link=evidence_hud_link,
        )
