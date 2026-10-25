import { parseDocument } from 'yaml';
import { z } from 'zod';
import type { RepositoryInspection } from './models.js';
import {
  AnalysisError,
  CONFIG_PATH,
  LIMITS,
  parseSnapshot,
  repositoryConfigSchema,
  type RepositoryFile,
  type RepositorySnapshot
} from './schemas.js';

const portValue = z.union([z.string(), z.number().int()]);
const readmeSchema = z
  .object({
    readonly_supported: z.boolean().optional(),
    nonroot_supported: z.boolean().optional(),
    available_architectures: z
      .array(z.object({ arch: z.string() }).passthrough())
      .max(LIMITS.metadataItems)
      .optional(),
    param_ports: z
      .array(z.object({ internal_port: portValue.optional() }).passthrough())
      .max(LIMITS.metadataItems)
      .optional(),
    opt_param_ports: z
      .array(z.object({ internal_port: portValue.optional() }).passthrough())
      .max(LIMITS.metadataItems)
      .optional()
  })
  .passthrough();
const jenkinsSchema = z
  .object({
    repo_vars: z.array(z.string()).max(LIMITS.metadataItems).optional()
  })
  .passthrough();
const composeSchema = z
  .object({
    services: z
      .record(
        z.string(),
        z
          .object({
            read_only: z.boolean().optional(),
            user: z.union([z.string(), z.number()]).optional()
          })
          .passthrough()
      )
      .refine(
        (services) => Object.keys(services).length <= LIMITS.metadataItems,
        'Too many Compose services.'
      )
      .optional()
  })
  .passthrough();

export function fileKind(path: string): string | null {
  if (path === CONFIG_PATH) return 'config';
  if (/^Dockerfile(?:\.[A-Za-z0-9_-]+)?$/.test(path)) return 'dockerfile';
  if (path === 'readme-vars.yml') return 'readme-vars';
  if (path === 'jenkins-vars.yml') return 'jenkins-vars';
  if (['README.md', 'Jenkinsfile', 'package_versions.txt'].includes(path))
    return 'generated-candidate';
  if (/^(?:docker-)?compose(?:\.[A-Za-z0-9_-]+)?\.ya?ml$/.test(path))
    return 'compose';
  if (path.startsWith('root/etc/s6-overlay/s6-rc.d/')) return 's6';
  return null;
}

export function lineOf(content: string, pattern: RegExp): number {
  const index = content.search(pattern);
  return index < 0 ? 1 : content.slice(0, index).split('\n').length;
}

export function generationMarkerLine(file: RepositoryFile): number | null {
  const prefixes =
    file.path === 'README.md'
      ? ['<!--']
      : file.path === 'Jenkinsfile'
        ? ['//', '/*', '*']
        : file.path === 'package_versions.txt'
          ? ['#']
          : [];
  const index = file.content
    .slice(0, 2_000)
    .split('\n')
    .findIndex(
      (line) =>
        prefixes.some((prefix) => line.trimStart().startsWith(prefix)) &&
        /\b(?:do not edit|auto[- ]generated|automatically generated)\b/i.test(
          line
        )
    );
  return index < 0 ? null : index + 1;
}

export function parseYaml(content: string): {
  value: unknown;
  line: number;
  valid: boolean;
} {
  try {
    const document = parseDocument(content, {
      uniqueKeys: true,
      prettyErrors: false,
      version: '1.2'
    });
    if (document.errors.length) {
      const position = document.errors[0].pos[0];
      return {
        value: null,
        line: content.slice(0, position).split('\n').length,
        valid: false
      };
    }
    return {
      value: document.toJS({ maxAliasCount: 20 }) as unknown,
      line: 1,
      valid: true
    };
  } catch {
    return { value: null, line: 1, valid: false };
  }
}

export function parseReadme(file: RepositoryFile | undefined) {
  if (!file) return undefined;
  const yaml = parseYaml(file.content);
  const result = readmeSchema.safeParse(yaml.value);
  return {
    file,
    valid: yaml.valid && result.success,
    line: yaml.line,
    value: result.success ? result.data : undefined
  };
}

export function parseJenkins(file: RepositoryFile | undefined) {
  if (!file) return undefined;
  const yaml = parseYaml(file.content);
  const result = jenkinsSchema.safeParse(yaml.value);
  return {
    file,
    valid: yaml.valid && result.success,
    line: yaml.line,
    value: result.success ? result.data : undefined
  };
}

export function parseCompose(file: RepositoryFile) {
  const yaml = parseYaml(file.content);
  const result = composeSchema.safeParse(yaml.value);
  return {
    file,
    valid: yaml.valid && result.success,
    line: yaml.line,
    value: result.success ? result.data : undefined
  };
}

const archAliases: Readonly<Record<string, string>> = {
  x86_64: 'amd64',
  amd64: 'amd64',
  '{{ arch_x86_64 }}': 'amd64',
  arm64: 'arm64',
  aarch64: 'arm64',
  '{{ arch_arm64 }}': 'arm64',
  armhf: 'arm',
  arm: 'arm',
  '{{ arch_armhf }}': 'arm'
};
export const normalizedArch = (value: string): string | undefined =>
  archAliases[value.trim()];

export function dockerInstructions(file: RepositoryFile) {
  const instructions: { instruction: string; value: string; line: number }[] =
    [];
  const lines = file.content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = index + 1;
    let text = lines[index].trim();
    if (!text || text.startsWith('#')) continue;
    while (text.endsWith('\\') && index + 1 < lines.length) {
      text = `${text.slice(0, -1)} ${lines[++index].trim()}`;
    }
    const match = /^([A-Za-z]+)\s+([\s\S]+)$/.exec(text);
    if (match)
      instructions.push({
        instruction: match[1].toUpperCase(),
        value: match[2],
        line
      });
  }
  return instructions;
}

export function normalizedPort(value: unknown): string | undefined {
  const text = String(value);
  const match = /^(\d{1,5})(?:\/(tcp|udp))?$/.exec(text);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535)
    return undefined;
  return `${Number(match[1])}/${match[2] ?? 'tcp'}`;
}

export function finalDockerStage(file: RepositoryFile) {
  const instructions = dockerInstructions(file);
  const index = instructions
    .map((item) => item.instruction)
    .lastIndexOf('FROM');
  return instructions.slice(Math.max(0, index));
}

export function dockerEnvironmentValue(
  instructions: ReturnType<typeof dockerInstructions>,
  name: string
): string | undefined {
  let value: string | undefined;
  for (const instruction of instructions) {
    if (instruction.instruction !== 'ENV') continue;
    const tokens: { text: string; escaped: boolean }[] = [];
    let text = '';
    let quoted: string | undefined;
    let escaping = false;
    let escaped = false;
    const flush = () => {
      if (text) tokens.push({ text, escaped });
      text = '';
      escaped = false;
    };
    for (const character of instruction.value) {
      if (escaping) {
        text += character;
        escaping = false;
        continue;
      }
      if (character === '\\') {
        escaping = true;
        escaped = true;
        continue;
      }
      if (quoted) {
        if (character === quoted) quoted = undefined;
        else text += character;
      } else if (character === '"' || character === "'") {
        quoted = character;
      } else if (character === ' ' || character === '\t') {
        flush();
      } else {
        text += character;
      }
    }
    if (quoted || escaping) {
      value = undefined;
      continue;
    }
    flush();
    if (!tokens[0]?.text.includes('=')) {
      if (tokens[0]?.text === name) {
        value = tokens.some((token) => token.escaped)
          ? undefined
          : tokens
              .slice(1)
              .map((token) => token.text)
              .join(' ');
      }
    } else {
      for (const token of tokens) {
        const index = token.text.indexOf('=');
        if (token.text.slice(0, index) === name)
          value = token.escaped ? undefined : token.text.slice(index + 1);
      }
    }
  }
  return value;
}

export function createContext(snapshot: RepositorySnapshot) {
  const files = new Map(snapshot.files.map((file) => [file.path, file]));
  const configFile = files.get(CONFIG_PATH);
  const configInput = configFile
    ? parseYaml(configFile.content)
    : { valid: true, value: { version: 1 } };
  const configResult = repositoryConfigSchema.safeParse(configInput.value);
  if (!configInput.valid || !configResult.success) {
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'Invalid .github/linuxserver-mcp.yml. Use version: 1, supported keys and read-only settings; automatic_writes and review_comments must be false.'
    );
  }
  const config = configResult.data;
  if (snapshot.profile) config.policy.profile = snapshot.profile;
  const readme = parseReadme(files.get('readme-vars.yml'));
  const jenkins = parseJenkins(files.get('jenkins-vars.yml'));
  const dockerfiles = snapshot.files.filter(
    (file) => fileKind(file.path) === 'dockerfile'
  );
  const compose = snapshot.files
    .filter((file) => fileKind(file.path) === 'compose')
    .map(parseCompose);
  return { snapshot, files, config, readme, jenkins, dockerfiles, compose };
}
export type AuditContext = ReturnType<typeof createContext>;

export function inspectionFrom(context: AuditContext): RepositoryInspection {
  const { files, snapshot, readme } = context;
  const knownArch = readme?.value?.available_architectures?.map(({ arch }) =>
    normalizedArch(arch)
  );
  return {
    files: snapshot.files.map((file) => {
      const kind = fileKind(file.path) ?? 'other';
      const source =
        file.path === 'README.md'
          ? 'readme-vars.yml'
          : ['Jenkinsfile', 'package_versions.txt'].includes(file.path)
            ? 'jenkins-vars.yml'
            : undefined;
      const marker = generationMarkerLine(file) !== null;
      return {
        path: file.path,
        kind,
        generatedFrom: marker && source && files.has(source) ? source : null
      };
    }),
    capabilities: {
      readOnly: readme?.value?.readonly_supported ?? null,
      nonRoot: readme?.value?.nonroot_supported ?? null
    },
    architectures:
      knownArch && knownArch.every((arch) => arch !== undefined)
        ? [...new Set(knownArch)].sort()
        : null
  };
}

export function inspectRepository(input: unknown): RepositoryInspection {
  return inspectionFrom(createContext(parseSnapshot(input)));
}
