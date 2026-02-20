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
import {
  getBestPractices,
  getGuidanceLinks,
  getOptimizationIdeas,
  getSkillsets,
  type BestPracticeProfile,
  type GuidanceTopic,
  type OptimizationScope,
  type SkillsetProfile
} from "./guidance.js";
import { auditImageCompliance, lookupOfficialLsioImage } from "./image-audit.js";
import { scaffoldLsioService } from "./scaffold.js";
import { renderDockerfile } from "./templates.js";
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

const server = new McpServer({
  name: "linuxserver-mcp-server",
  version: "0.1.1"
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

const auditSchema = {
  ...serviceSpecSchema,
  candidateDockerfile: z.string().optional(),
  candidateCompose: z.string().optional(),
  candidateReadme: z.string().optional(),
  checkOfficialImage: z.boolean().default(true)
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
    const payload = getGuidanceLinks(topic);

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
      profile: z
        .enum(["all", "docker", "permissions", "filesystem", "docs", "review", "skillsets"])
        .default("all")
    }
  },
  async ({ profile }: { profile: BestPracticeProfile }) => {
    const payload = getBestPractices(profile);

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
  "lsio.get_skillsets",
  {
    title: "Get LSIO skillset profiles",
    description:
      "Returns structured skillset profiles for discovery, maintenance, review, release, and documentation workflows.",
    inputSchema: {
      profile: z.enum(["all", "discovery", "maintenance", "review", "release", "docs"]).default("all")
    }
  },
  async ({ profile }: { profile: SkillsetProfile }) => {
    const payload = getSkillsets(profile);

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
  "lsio.get_optimization_ideas",
  {
    title: "Get optimization ideas",
    description:
      "Returns prioritized LSIO-aligned improvement ideas for server capabilities, image compliance, release readiness, and quality.",
    inputSchema: {
      scope: z.enum(["all", "server", "image", "release", "quality"]).default("all")
    }
  },
  async ({ scope }: { scope: OptimizationScope }) => {
    const payload = getOptimizationIdeas(scope);

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
  "lsio.lookup_official_image",
  {
    title: "Lookup official LSIO image",
    description:
      "Checks whether an image appears in the official LinuxServer.io images catalog and returns docs signal metadata.",
    inputSchema: {
      imageName: z.string().min(2)
    }
  },
  async ({ imageName }: { imageName: string }) => {
    const payload = await lookupOfficialLsioImage(imageName);

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
  "lsio.audit_image_compliance",
  {
    title: "Audit image compliance",
    description:
      "Audits a candidate image spec/artifacts against LSIO standards and returns recommendations plus remediation scaffolds.",
    inputSchema: auditSchema
  },
  async (input: ServiceSpecInput & {
    candidateDockerfile?: string | undefined;
    candidateCompose?: string | undefined;
    candidateReadme?: string | undefined;
    checkOfficialImage?: boolean | undefined;
  }) => {
    const officialImage = input.checkOfficialImage === false ? undefined : await lookupOfficialLsioImage(input.imageName);
    const auditInput = {
      imageName: input.imageName,
      baseImage: input.baseImage,
      ...(input.maintainer !== undefined ? { maintainer: input.maintainer } : {}),
      ...(input.appPort !== undefined ? { appPort: input.appPort } : {}),
      ...(input.serviceName !== undefined ? { serviceName: input.serviceName } : {}),
      ...(input.readOnlyRootFs !== undefined ? { readOnlyRootFs: input.readOnlyRootFs } : {}),
      ...(input.includeHealthcheck !== undefined ? { includeHealthcheck: input.includeHealthcheck } : {}),
      ...(input.candidateDockerfile !== undefined ? { candidateDockerfile: input.candidateDockerfile } : {}),
      ...(input.candidateCompose !== undefined ? { candidateCompose: input.candidateCompose } : {}),
      ...(input.candidateReadme !== undefined ? { candidateReadme: input.candidateReadme } : {})
    };

    const payload = auditImageCompliance(
      auditInput,
      officialImage
    );

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
  "lsio.generate_dockerfile",
  {
    title: "Generate LSIO Dockerfile",
    description: "Generates an LSIO-oriented Dockerfile from service metadata and returns validation findings.",
    inputSchema: serviceSpecSchema
  },
  async (input: ServiceSpecInput) => {
    const validation = validateLsioSpec(input as ServiceSpec);
    const dockerfile = renderDockerfile(input as ServiceSpec);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              fileName: "Dockerfile",
              dockerfile,
              validation,
              nextSteps: [
                "Place generated Dockerfile at repository root.",
                "Add root/ service files and ensure /config volume behavior is documented.",
                "Run lsio.audit_image_compliance with candidate artifacts before publishing."
              ]
            },
            null,
            2
          )
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
