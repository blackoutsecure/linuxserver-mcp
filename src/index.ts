#!/usr/bin/env node
/**
 * LinuxServer.io MCP Server
 * Module: MCP tool registration and stdio server bootstrap
 * Standards basis: LSIO docs for container conventions, support, and execution guidance
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scaffoldLsioService } from "./scaffold.js";
import type { ServiceSpec } from "./types.js";
import { validateLsioSpec } from "./validation.js";

type ServiceSpecInput = {
  imageName: string;
  baseImage: "alpine" | "ubuntu";
  maintainer?: string | undefined;
  appPort?: number | undefined;
  serviceName?: string | undefined;
  readOnlyRootFs?: boolean | undefined;
  includeHealthcheck?: boolean | undefined;
};

type GuidanceTopic = "all" | "base-image" | "permissions" | "read-only" | "support" | "compose" | "branding";
type BestPracticeProfile = "all" | "docker" | "permissions" | "filesystem" | "docs" | "review";

const server = new McpServer({
  name: "linuxserver-mcp-server",
  version: "0.1.0"
});

const serviceSpecSchema = {
  imageName: z.string().min(2),
  baseImage: z.enum(["alpine", "ubuntu"]).default("alpine"),
  maintainer: z.string().optional(),
  appPort: z.number().int().min(1).max(65535).optional(),
  serviceName: z.string().optional(),
  readOnlyRootFs: z.boolean().optional(),
  includeHealthcheck: z.boolean().optional()
};

server.registerTool(
  "lsio.validate_spec",
  {
    title: "Validate LSIO service spec",
    description: "Validates LinuxServer.io-oriented service metadata and checks common convention issues.",
    inputSchema: serviceSpecSchema
  },
  async (input: ServiceSpecInput) => {
    const validation = validateLsioSpec(input as ServiceSpec);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(validation, null, 2)
        }
      ]
    };
  }
);

server.registerTool(
  "lsio.generate_scaffold",
  {
    title: "Generate LSIO scaffold content",
    description: "Generates Dockerfile and docs snippets aligned to LSIO conventions.",
    inputSchema: serviceSpecSchema
  },
  async (input: ServiceSpecInput) => {
    const scaffold = scaffoldLsioService(input as ServiceSpec);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(scaffold, null, 2)
        }
      ]
    };
  }
);

server.registerTool(
  "lsio.get_guidance_links",
  {
    title: "Get LSIO guidance links",
    description: "Returns authoritative LinuxServer.io references for docs, API, support, and conventions.",
    inputSchema: {
      topic: z
        .enum(["all", "base-image", "permissions", "read-only", "support", "compose", "branding"])
        .default("all")
    }
  },
  async ({ topic }: { topic: GuidanceTopic }) => {
    const links = {
      site: "https://www.linuxserver.io/",
      docs: "https://docs.linuxserver.io/",
      api: "https://docs.linuxserver.io/API/",
      faq: "https://docs.linuxserver.io/FAQ/",
      ci: "https://ci.linuxserver.io/",
      discord: "https://linuxserver.io/discord",
      forums: "https://discourse.linuxserver.io/",
      nonRoot: "https://docs.linuxserver.io/misc/non-root/",
      readOnly: "https://docs.linuxserver.io/misc/read-only/",
      supportPolicy: "https://docs.linuxserver.io/misc/support-policy/",
      compose: "https://docs.linuxserver.io/general/docker-compose/",
      branding: "https://docs.linuxserver.io/general/container-branding/",
      execution: "https://docs.linuxserver.io/general/container-execution/",
      puidPgid: "https://docs.linuxserver.io/general/understanding-puid-and-pgid/"
    };

    const byTopic: Record<string, unknown> = {
      "base-image": { site: links.site, docs: links.docs, execution: links.execution },
      permissions: { nonRoot: links.nonRoot, puidPgid: links.puidPgid },
      "read-only": { readOnly: links.readOnly },
      support: {
        faq: links.faq,
        supportPolicy: links.supportPolicy,
        discord: links.discord,
        forums: links.forums,
        ci: links.ci
      },
      compose: { compose: links.compose, execution: links.execution },
      branding: { branding: links.branding }
    };

    const payload = topic === "all" ? links : byTopic[topic] ?? links;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2)
        }
      ]
    };
  }
);

server.registerTool(
  "lsio.get_best_practices",
  {
    title: "Get LSIO best-practice checklist",
    description: "Returns task-ready LinuxServer.io best-practice checklists for implementation and review.",
    inputSchema: {
      profile: z.enum(["all", "docker", "permissions", "filesystem", "docs", "review"]).default("all")
    }
  },
  async ({ profile }: { profile: BestPracticeProfile }) => {
    const practices = {
      docker: [
        "Use LSIO base image patterns and s6-overlay-compatible service assumptions.",
        "Keep generated Dockerfile snippets aligned with LSIO repo and runtime conventions.",
        "Provide practical compose/run examples for users and maintainers."
      ],
      permissions: [
        "Document and support PUID/PGID-based runtime permissions.",
        "Prefer non-root guidance patterns from LSIO docs when describing security posture."
      ],
      filesystem: [
        "Represent /config as persistent storage in examples.",
        "Account for /app and /defaults conventions in scaffolded guidance.",
        "When read-only mode is discussed, document writable exceptions and volume expectations."
      ],
      docs: [
        "Use LSIO docs as authoritative references in generated guidance.",
        "Avoid claiming official LSIO endorsement unless explicitly approved.",
        "Prefer concise, actionable documentation over generic narrative."
      ],
      review: [
        "Run validation first, then scaffold generation.",
        "Check for LSIO alignment in base image, permissions, directories, and compose examples.",
        "Keep comments/headers concise with purpose, standards basis, and approval status where applicable.",
        "Use available task-relevant skills/tools; otherwise fall back to LSIO references."
      ]
    };

    const payload =
      profile === "all"
        ? {
            docker: practices.docker,
            permissions: practices.permissions,
            filesystem: practices.filesystem,
            docs: practices.docs,
            review: practices.review
          }
        : { [profile]: practices[profile] };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2)
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
