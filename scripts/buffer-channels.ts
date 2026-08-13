import { loadLocalEnv } from "../server/secrets";

type BufferAccountResponse = {
  account?: {
    organizations?: Array<{
      id: string;
      name: string;
    }>;
  };
};

type BufferChannelsResponse = {
  channels?: Array<{
    id: string;
    name: string;
    displayName?: string | null;
    service: string;
    descriptor: string;
    isDisconnected: boolean;
    isLocked: boolean;
  }>;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing. Paste your Buffer API key into .env.local or Connections > Buffer first.`);
  return value;
}

async function bufferGraphql<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${requiredEnv("BUFFER_API_KEY")}`
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
  if (!response.ok || data.errors?.length) {
    throw new Error(data.errors?.[0]?.message ?? `Buffer API failed with HTTP ${response.status}`);
  }
  return data.data as T;
}

async function main() {
  loadLocalEnv();
  const account = await bufferGraphql<BufferAccountResponse>(`
    query BufferOrganizations {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);
  const organizations = account.account?.organizations ?? [];
  if (organizations.length === 0) throw new Error("No Buffer organizations found for this API key.");

  for (const organization of organizations) {
    const data = await bufferGraphql<BufferChannelsResponse>(`
      query BufferChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          displayName
          service
          descriptor
          isDisconnected
          isLocked
        }
      }
    `, { organizationId: organization.id });

    console.log(`\nOrganization: ${organization.name} (${organization.id})`);
    for (const channel of data.channels ?? []) {
      const status = channel.isDisconnected ? "disconnected" : channel.isLocked ? "locked" : "ready";
      const marker = channel.service.toLowerCase().includes("tiktok") ? "  <-- TikTok channel ID" : "";
      console.log(`${channel.service} | ${channel.displayName ?? channel.name} | ${status}`);
      console.log(`ID: ${channel.id}${marker}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not list Buffer channels.");
  process.exit(1);
});
