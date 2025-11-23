# CLAUDE.md - AI Assistant Guide for Podson

This document provides comprehensive guidance for AI assistants working on the **podson** codebase.

## Project Overview

**Podson** is a TypeScript library that parses podcast RSS/XML feeds into strongly-typed JSON objects. It's designed for modern Node.js projects with full ESM and CommonJS support.

- **Language**: TypeScript
- **Target**: Node.js (ES2020+)
- **Module Systems**: Both ESM (`.mjs`) and CommonJS (`.cjs`)
- **Package Manager**: npm (lockfile not tracked, works with npm/yarn/pnpm/bun)
- **License**: MIT

## Repository Structure

```
podson/
├── src/
│   ├── index.ts                    # Main entry point with getPodcast() function
│   ├── types.ts                    # TypeScript type definitions
│   ├── index.test.ts               # Unit tests (with mocks)
│   └── index.integration.test.ts   # Integration tests (real feeds)
├── dist/                           # Build output (gitignored)
│   ├── index.cjs                   # CommonJS bundle
│   ├── index.mjs                   # ESM bundle
│   ├── index.d.ts                  # ESM type definitions
│   └── index.d.cts                 # CommonJS type definitions
├── package.json                    # Package manifest
├── tsconfig.json                   # TypeScript configuration
├── tsup.config.ts                  # Build configuration (tsup)
├── vitest.config.ts                # Test configuration (vitest)
├── eslint.config.mjs               # Linting configuration (ESLint 9)
├── .prettierrc.json                # Code formatting configuration
├── README.md                       # User-facing documentation
├── LICENSE                         # MIT license
└── CLAUDE.md                       # This file
```

## Core Architecture

### Main Components

1. **`src/index.ts`** - Core functionality
   - `getPodcast(feedUrl: string)`: Main exported function
   - `parse(feedXML: string)`: Internal XML parsing logic using SAX parser
   - `finalizePodcast(result: Podcast)`: Post-processing (sorting, defaults)
   - Helper functions: `parseLanguage()`, `parseTime()`

2. **`src/types.ts`** - Type definitions
   - `Podcast`: Main podcast feed interface
   - `Episode`: Individual episode interface
   - `Enclosure`: Media file metadata
   - `Chapter`: Episode chapter markers
   - `Owner`: Podcast owner information

### Key Dependencies

- **`got`** (v14.6.5): HTTP client for fetching feeds
  - Configured with 10s timeout, max 10 redirects
  - Returns text responses for XML parsing

- **`sax`** (v1.4.3): Streaming XML parser
  - Event-based parsing (onopentag, onclosetag, ontext)
  - Lowercase tag names enabled

- **`lodash`** (v4.17.21): Utilities
  - Only `uniq` is used (for deduplicating categories)

### Parsing Logic

The SAX parser uses a **node-based state machine**:

```typescript
interface ParsingNode {
  name: string;                    // Current tag name
  attributes: Record<string, string>;
  parent: ParsingNode | null;      // Parent tag
  target?: Partial<Podcast> | Partial<Episode> | Partial<Owner>;
  textMap?: Record<string, ...>;   // Maps tag names to object properties
}
```

- Builds a tree as it parses
- Uses `textMap` to map XML tags to object properties
- Handles nested structures (channel → episodes, categories)
- Special handling for iTunes tags, categories, enclosures, chapters

### Data Processing

1. **Episode Sorting**: Episodes are sorted by `published` date (newest first)
2. **Category Deduplication**: Categories are made unique and sorted alphabetically
3. **Hierarchical Categories**: Nested iTunes categories use `>` separator (e.g., `Technology>Podcasting`)
4. **Default `updated` Field**: Set to most recent episode's publish date if not in feed

## Development Workflow

### Setup

```bash
npm install          # Install dependencies
```

### Available Scripts

```bash
npm run build        # Build for production (outputs to dist/)
npm run typecheck    # Type-check without emitting files
npm run lint         # Lint source files with ESLint
npm run format       # Format code with Prettier
npm run format:check # Check formatting without modifying
npm test             # Run all tests (unit + integration)
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with Vitest UI
npm run test:coverage # Run tests with coverage report
npm run test:integration # Run only integration tests
```

### Build Process (tsup)

**Configuration**: `tsup.config.ts`

- **Entry**: `src/index.ts`
- **Output**: `dist/`
- **Formats**: Both CJS (`.cjs`) and ESM (`.mjs`)
- **Type Definitions**: Generated for both formats (`.d.ts` and `.d.cts`)
- **Sourcemaps**: Enabled
- **Tree-shaking**: Enabled
- **External Dependencies**: `got`, `sax`, `lodash` (not bundled)
- **Target**: ES2020

### Testing Strategy

**Framework**: Vitest (v4.0.13)

#### Unit Tests (`src/index.test.ts`)
- Mock `got` module to avoid real HTTP requests
- Test parsing logic with sample XML
- Test error handling (timeouts, HTTP errors, parsing errors)
- Test edge cases (empty feeds, malformed XML)

#### Integration Tests (`src/index.integration.test.ts`)
- Test against real podcast feeds
- Verify redirect handling
- Validate complete workflow

**Run tests**:
```bash
npm test                    # Run all tests
npm run test:integration    # Run only integration tests
npm run test:watch          # Watch mode for development
```

### Code Quality

#### TypeScript
- **Strict mode**: Enabled
- **Target**: ES2020
- **Module**: ESNext (bundler resolution)
- All source must have type safety
- No `any` types (warn level)

#### ESLint
- **Config**: ESLint 9 flat config (`eslint.config.mjs`)
- **Parser**: typescript-eslint
- **Rules**:
  - Semicolons required (`semi: error`)
  - Single quotes (`quotes: error`)
  - Console allowed (`no-console: off`)
  - Explicit `any` warns but doesn't error

#### Prettier
- **Config**: `.prettierrc.json`
- Semicolons: `true`
- Single quotes: `true`
- Trailing commas: ES5
- Tab width: 2 spaces
- Print width: 80 characters

## Code Conventions

### File Organization
- One main entry point (`src/index.ts`)
- Separate types file (`src/types.ts`)
- Co-located tests (`.test.ts` suffix)
- No subdirectories in `src/` (flat structure)

### Naming Conventions
- **Files**: kebab-case (e.g., `index.test.ts`)
- **Interfaces**: PascalCase (e.g., `Podcast`, `Episode`)
- **Functions**: camelCase (e.g., `getPodcast`, `parseTime`)
- **Constants**: camelCase for most, UPPER_CASE for true constants

### Error Handling
- All errors should be thrown as `Error` objects with descriptive messages
- Network errors should include the feed URL
- HTTP errors should include status code
- Timeout errors should be explicit
- Parsing errors should mention "parsing" in the message

Example:
```typescript
throw new Error(`Timeout fetching podcast feed: ${feedUrl}`);
throw new Error(`Failed to fetch podcast (HTTP ${statusCode}): ${feedUrl}`);
throw new Error(`Failed to parse podcast feed: ${errorMessage}`);
```

### TypeScript Patterns
- Use `interface` for object shapes (not `type`)
- Make fields optional (`?`) unless guaranteed to exist
- Use proper type guards for error handling
- Export types from main entry point for convenience
- Document types with JSDoc comments

### Documentation
- All public APIs must have JSDoc comments
- Include `@param`, `@returns`, `@throws` tags
- Provide usage examples in JSDoc
- Keep README.md in sync with actual behavior

## Git Workflow

### Branch Strategy
- **Main branch**: `main` (or default branch)
- **Feature branches**: `claude/description-sessionid` format
- Always develop on designated branch
- Never push to `main` without permission

### Commit Messages
- Use conventional commit style
- Be descriptive but concise
- Examples:
  - `Add integration tests and improve redirect handling`
  - `Fix parsing error for malformed XML`
  - `Update types for better null safety`

### Push Protocol
```bash
# Always use -u flag for first push
git push -u origin <branch-name>

# Branch MUST start with 'claude/' and end with session ID
# If push fails with 403, check branch naming

# Network failures: retry up to 4 times with exponential backoff
# Wait times: 2s, 4s, 8s, 16s
```

## Common Tasks for AI Assistants

### Adding a New Feature

1. **Read existing code first** - Never modify without understanding
2. **Update types** in `src/types.ts` if needed
3. **Implement logic** in `src/index.ts`
4. **Add tests** in `src/index.test.ts` (unit) and/or integration test
5. **Run quality checks**:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
6. **Update README.md** if public API changed
7. **Commit with descriptive message**

### Fixing a Bug

1. **Reproduce the issue** - Add a failing test first
2. **Fix the code** - Minimal changes to address the bug
3. **Verify the fix**:
   ```bash
   npm test              # Tests pass
   npm run typecheck     # No type errors
   npm run build         # Builds successfully
   ```
4. **Don't over-engineer** - Fix only what's broken
5. **Commit with clear description** of bug and fix

### Refactoring

1. **Ensure tests exist** - Don't refactor untested code
2. **Run tests before** to establish baseline
3. **Make incremental changes**
4. **Run tests after each change**
5. **Keep behavior identical** - Tests should still pass
6. **Avoid unnecessary changes** - Don't "improve" unrelated code

### Updating Dependencies

1. **Check compatibility** - Read changelogs for breaking changes
2. **Update package.json**
3. **Test thoroughly**:
   ```bash
   npm install
   npm test
   npm run test:integration
   npm run build
   ```
4. **Document if breaking** - Note in commit message

## Important Constraints

### Security
- **No command injection**: Never pass user input directly to shell
- **No XSS**: Properly escape/sanitize any HTML content
- **No SQL injection**: Not applicable (no database)
- **Validate inputs**: Check feedUrl format, handle malformed XML gracefully
- **Timeout protection**: Already implemented (10s timeout)

### Backward Compatibility
- **Don't break public API** without major version bump
- **Keep exports stable**: `getPodcast`, all type exports
- **Maintain type compatibility**: Don't remove optional fields
- **Document breaking changes**: Use commit messages

### Code Quality Standards
- **No `any` types** unless absolutely necessary (warn level)
- **All exports documented** with JSDoc
- **100% type coverage** - no implicit any
- **Tests for new features** - both unit and integration if applicable
- **Linting must pass** - `npm run lint` succeeds
- **Formatting must match** - `npm run format:check` succeeds

### What NOT to Do
- ❌ Don't add features not requested
- ❌ Don't refactor unrelated code
- ❌ Don't add comments to code you didn't change
- ❌ Don't create abstractions for one-time operations
- ❌ Don't add error handling for impossible scenarios
- ❌ Don't use backwards-compatibility hacks (like `_unused` variables)
- ❌ Don't add docstrings to unchanged functions
- ❌ Don't create new files unless necessary
- ❌ Don't bundle dependencies (keep them external)
- ❌ Don't use `console.log` for debugging (use tests instead)

## Testing Guidelines

### Unit Test Patterns

```typescript
import { describe, it, expect, vi } from 'vitest';

// Always mock external dependencies
vi.mock('got', () => ({
  default: vi.fn(),
}));

describe('feature name', () => {
  it('should do something specific', async () => {
    // Arrange
    const mockData = '...';

    // Act
    const result = await someFunction(mockData);

    // Assert
    expect(result).toEqual(expectedValue);
  });
});
```

### Integration Test Patterns

```typescript
// Test against real feeds
it('should fetch and parse real podcast', async () => {
  const podcast = await getPodcast('https://example.com/feed.xml');
  expect(podcast.title).toBeDefined();
  expect(podcast.episodes).toBeDefined();
});
```

### Test Coverage
- Aim for high coverage, but don't test implementation details
- Focus on public API behavior
- Test error paths, not just happy paths
- Use mocks for external dependencies in unit tests
- Use real services sparingly in integration tests

## Release Process

1. **Ensure all tests pass**: `npm test`
2. **Ensure build succeeds**: `npm run build`
3. **Ensure linting passes**: `npm run lint`
4. **Ensure formatting is correct**: `npm run format:check`
5. **Update version** in `package.json`
6. **Update README** if needed
7. **Create git tag**: `git tag v2.0.x`
8. **Publish**: `npm publish` (requires permissions)

## Troubleshooting

### Common Issues

**Build fails**:
```bash
rm -rf dist node_modules
npm install
npm run build
```

**Tests fail**:
- Check if mocks are properly configured
- Verify test data matches current implementation
- Run `npm run test:watch` to debug

**Type errors**:
```bash
npm run typecheck  # Shows all type errors
```

**Linting errors**:
```bash
npm run lint       # Shows errors
npm run format     # Auto-fixes formatting
```

**Integration tests fail**:
- Check network connection
- Verify test feed URLs are still active
- Check for redirect changes

## Resources

- **Repository**: https://github.com/keldrik/podson
- **npm Package**: https://www.npmjs.com/package/podson
- **TypeScript Docs**: https://www.typescriptlang.org/
- **Vitest Docs**: https://vitest.dev/
- **tsup Docs**: https://tsup.egoist.dev/

## Questions?

When in doubt:
1. Read the existing code first
2. Check test files for patterns
3. Run tests to verify behavior
4. Keep changes minimal and focused
5. Ask the user for clarification if requirements are unclear

---

**Last Updated**: 2025-11-23
**Version**: 2.0.2
