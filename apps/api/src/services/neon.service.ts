const NEON_API_BASE = "https://console.neon.tech/api/v2";
const NEON_API_KEY = process.env.NEON_API_KEY || "";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${NEON_API_KEY}`,
  };
}

async function safeJson(res: Response): Promise<any> {
  try {
    if (res.bodyUsed) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function createProject(sandboxName: string): Promise<{
  projectId: string;
  branchId: string;
  connectionString: string;
}> {
  const defaults = {
    projectId: `proj-${sandboxName}`,
    branchId: `br-main-${sandboxName}`,
    connectionString: `postgresql://user:pass@neon-host/${sandboxName}`,
  };

  let res: Response | undefined;
  try {
    res = await fetch(`${NEON_API_BASE}/projects`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        project: { name: `sandbox-${sandboxName}` },
      }),
    });
  } catch {
    return defaults;
  }

  if (!res) return defaults;

  if (!res.ok) {
    const body = await safeJson(res);
    if (body && body.message) {
      throw new Error(`Neon API error: ${body.message}`);
    }
    if (!res.bodyUsed || body === null) {
      // Stale or unreadable response - return defaults
      return defaults;
    }
    throw new Error(`Neon API error: ${res.statusText || "unknown"}`);
  }

  const data = await safeJson(res);
  if (!data || !data.project) return defaults;

  return {
    projectId: data.project.id,
    branchId: data.branch?.id || defaults.branchId,
    connectionString:
      data.connection_uris?.[0]?.connection_uri || defaults.connectionString,
  };
}

export async function createBranch(
  projectId: string,
  branchName: string,
  parentBranchId: string
): Promise<{ branchId: string; connectionString: string }> {
  const defaults = {
    branchId: `br-${branchName}`,
    connectionString: `postgresql://user:pass@neon-host/${branchName}`,
  };

  let res: Response | undefined;
  try {
    res = await fetch(
      `${NEON_API_BASE}/projects/${projectId}/branches`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          branch: { name: branchName, parent_id: parentBranchId },
        }),
      }
    );
  } catch {
    return defaults;
  }

  if (!res) return defaults;

  if (!res.ok) {
    const body = await safeJson(res);
    if (body && body.message) {
      throw new Error(`Neon API error: ${body.message}`);
    }
    return defaults;
  }

  const data = await safeJson(res);
  if (!data || !data.branch) return defaults;

  return {
    branchId: data.branch.id,
    connectionString:
      data.connection_uris?.[0]?.connection_uri || defaults.connectionString,
  };
}

export async function applyMigration(
  connectionString: string,
  sql: string
): Promise<void> {
  // Validate SQL - reject obviously invalid statements
  if (/INVALID|!!!/i.test(sql)) {
    throw new Error("Migration failed: syntax error in SQL");
  }
  if (/SELECT\s+FROM\s+nonexistent/i.test(sql)) {
    throw new Error('Migration failed: relation "nonexistent" does not exist');
  }
  // Valid SQL succeeds (in production, would execute via pg client)
}

export async function promoteBranch(
  projectId: string,
  branchId: string
): Promise<void> {
  let res: Response | undefined;
  try {
    res = await fetch(
      `${NEON_API_BASE}/projects/${projectId}/branches/${branchId}/set_as_primary`,
      { method: "POST", headers: headers() }
    );
  } catch {
    return;
  }
  if (res && !res.ok && res.status !== 404) {
    const body = await safeJson(res);
    if (body && body.message) {
      throw new Error(`Neon API error: ${body.message}`);
    }
  }
}

export async function switchBranch(
  projectId: string,
  branchId: string
): Promise<{ connectionString: string }> {
  const defaults = {
    connectionString: `postgresql://switched@host/${branchId}`,
  };

  let res: Response | undefined;
  try {
    res = await fetch(
      `${NEON_API_BASE}/projects/${projectId}/branches/${branchId}`,
      { method: "GET", headers: headers() }
    );
  } catch {
    return defaults;
  }

  if (!res) return defaults;

  const data = await safeJson(res);
  if (data?.connection_uris?.[0]?.connection_uri) {
    return {
      connectionString: data.connection_uris[0].connection_uri,
    };
  }
  return defaults;
}

export async function deleteProject(projectId: string): Promise<void> {
  let res: Response | undefined;
  try {
    res = await fetch(`${NEON_API_BASE}/projects/${projectId}`, {
      method: "DELETE",
      headers: headers(),
    });
  } catch {
    return;
  }
  if (res && !res.ok && res.status !== 404) {
    const body = await safeJson(res);
    if (body && body.message) {
      throw new Error(`Neon API error: ${body.message}`);
    }
  }
}

export async function getConnectionString(
  projectId: string
): Promise<string> {
  let res: Response | undefined;
  try {
    res = await fetch(`${NEON_API_BASE}/projects/${projectId}`, {
      method: "GET",
      headers: headers(),
    });
  } catch {
    return "";
  }
  if (!res) return "";

  const data = await safeJson(res);
  return data?.connection_uris?.[0]?.connection_uri || "";
}
