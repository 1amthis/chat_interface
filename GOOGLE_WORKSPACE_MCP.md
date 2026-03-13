# Google Workspace MCP

This app can launch Google Workspace tools through the legacy `gws mcp` mode.

## Important version note

Google Workspace CLI documented MCP support in its docs site, but upstream also removed `gws mcp` in release `v0.8.0` on March 7, 2026. For that reason, the preset in this app pins `@googleworkspace/cli@0.6.3`.

## Recommended preset

In Settings -> MCP Tools, use the `Google Workspace CLI` preset. It creates this stdio server:

- Command: `npx`
- Args: `-y @googleworkspace/cli@0.6.3 mcp -s drive,gmail,calendar --tool-mode compact`

`compact` is the important flag here. The legacy CLI defaults to `full`, which exposes roughly one tool per API method and becomes noisy very quickly.

If you want the smallest useful setup, narrow the services too:

- Drive only: `-s drive --tool-mode compact`
- Gmail only: `-s gmail --tool-mode compact`
- Calendar only: `-s calendar --tool-mode compact`

## Authentication

Prerequisite: install the Google Cloud CLI (`gcloud`) first. The legacy package aborts `auth setup` with `gcloud CLI not found` when it is missing.

Run the legacy CLI once to configure OAuth before testing the server:

```bash
npx -y @googleworkspace/cli@0.6.3 auth setup
```

Then authenticate the account you want to use:

```bash
npx -y @googleworkspace/cli@0.6.3 auth login -s drive,gmail,calendar
```

For a smaller scope request, match the services you actually expose in MCP. Example:

```bash
npx -y @googleworkspace/cli@0.6.3 auth login --readonly -s drive
```

If your environment does not expose a desktop keyring cleanly, add stdio env vars in the MCP server form. Common examples:

```text
GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file
GOOGLE_WORKSPACE_CLI_ACCOUNT=default
```

## Notes

- The preset is intentionally pinned. Replacing it with `latest` is expected to break MCP mode.
- Start with a small service list if tool discovery becomes noisy.
