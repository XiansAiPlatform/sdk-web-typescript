# npm Package Documentation

This document provides comprehensive instructions for building, publishing, and consuming the @99xio/xians-sdk-typescript npm package.

## Table of Contents

1. [Automated Publishing via GitHub Actions](#automated-publishing-via-github-actions)
2. [Manual Publishing npm Packages (not recommended)](#manual-publishing-npm-packages-not-recommended)
3. [Consuming Published npm Packages](#consuming-published-npm-packages)
4. [Building and Testing Packages Locally](#building-and-testing-packages-locally)
5. [Troubleshooting](#troubleshooting)

---

## Automated Publishing via GitHub Actions

### Overview

The repository includes GitHub Actions automation that automatically builds and publishes npm packages when you create version tags.

### Quick Start

Change the version in the package.json file:

```json
{
  "version": "1.2.3"
}
```

```bash
# Define the version
export VERSION=1.2.3 # or 1.2.3-beta for pre-release

# Create and push a version tag
git tag -a v$VERSION -m "Release v$VERSION"
git push origin v$VERSION
```

### Delete existing tag (optional)

```bash
git tag -d v$VERSION
git push origin :refs/tags/v$VERSION
```

### What Gets Published

The automation publishes to: **npmjs.com** with package ID `@99xio/xians-sdk-typescript`

**Package Information:**

- **Package ID**: `@99xio/xians-sdk-typescript`
- **Target**: ES2020, CommonJS + ES Modules
- **Authors**: `99x`
- **Repository**: `https://github.com/99xio/xians-sdk-typescript`
- **Registry**: `https://registry.npmjs.org`

### Version Tag Examples

**Stable releases:**

- `v1.2.3` → Package version `1.2.3`
- `v2.0.0` → Package version `2.0.0`

**Pre-releases:**

- `v1.2.3-beta` → Package version `1.2.3-beta`
- `v2.0.0-alpha` → Package version `2.0.0-alpha`
- `v1.2.3-rc1` → Package version `1.2.3-rc1`

### Workflow Features

- **Automatic Version Extraction**: Strips 'v' prefix from tags
- **Version Validation**: Ensures semantic versioning format
- **Dependency Installation**: Installs dependencies with `npm ci`
- **Testing**: Runs test suite before publishing
- **Build Verification**: Validates build output files
- **Public Access**: Publishes with `--access public` for scoped packages
- **Build Summary**: Generates detailed publish summary with installation commands

### Monitoring Builds

1. Go to the repository's **Actions** tab on GitHub
2. Look for "Build and Publish to npm" workflows
3. Check [npmjs.com](https://www.npmjs.com/package/@99xio/xians-sdk-typescript) for newly published packages

---

## Manual Publishing npm Packages (not recommended)

### Prerequisites

- Node.js 16+ installed
- npm account with access to @99xio organization
- npm CLI logged in (`npm login`)

### Step-by-Step Instructions

1. **Set up your environment:**

   ```bash
   npm login
   export VERSION=1.2.3
   ```

2. **Update version and build:**

   ```bash
   npm version $VERSION --no-git-tag-version
   npm install
   npm run build
   npm run test:run
   ```

3. **Publish manually:**

   ```bash
   npm publish --access public
   ```

### What the Manual Process Does

- **Updates package.json** - Sets the new version number
- **Installs dependencies** - Ensures all dependencies are up to date
- **Builds the package** - Compiles TypeScript and generates distribution files
- **Runs tests** - Validates the package before publishing
- **Publishes to npm** - Uploads the package to npmjs.com

---

## Consuming Published npm Packages

### npm

```bash
npm install @99xio/xians-sdk-typescript
```

### yarn

```bash
yarn add @99xio/xians-sdk-typescript
```

### pnpm

```bash
pnpm add @99xio/xians-sdk-typescript
```

### Specific Version Installation

```bash
# Exact version
npm install @99xio/xians-sdk-typescript@1.2.3

# Latest beta
npm install @99xio/xians-sdk-typescript@beta

# Version range
npm install @99xio/xians-sdk-typescript@^1.2.0
```

### Using in Code

#### ES Modules (Recommended)

```typescript
import { AgentSDK, RestSDK, SocketSDK, SseSDK } from '@99xio/xians-sdk-typescript';

// Create SDK instances
const restSDK = new RestSDK({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key'
});

const socketSDK = new SocketSDK({
  url: 'wss://api.example.com/hub',
  apiKey: 'your-api-key'
});
```

#### CommonJS

```javascript
const { AgentSDK, RestSDK, SocketSDK, SseSDK } = require('@99xio/xians-sdk-typescript');

// Use the SDKs
const restSDK = new RestSDK({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key'
});
```

#### Browser (via CDN)

```html
<script type="module">
  import { RestSDK } from 'https://unpkg.com/@99xio/xians-sdk-typescript@latest/dist/index.esm.js';
  
  const sdk = new RestSDK({
    baseUrl: 'https://api.example.com',
    apiKey: 'your-api-key'
  });
</script>
```

### Version Specifications

| Version Pattern | Description | Example |
|----------------|-------------|---------|
| `1.2.3` | Exact version | `1.2.3` |
| `^1.2.3` | Compatible version | `1.2.3`, `1.2.4`, `1.3.0` (not `2.0.0`) |
| `~1.2.3` | Reasonably close | `1.2.3`, `1.2.4` (not `1.3.0`) |
| `>=1.2.3` | Minimum version | `1.2.3` or higher |
| `1.2.3-beta` | Pre-release version | Specific pre-release |

---

## Building and Testing Packages Locally

### For Development and Testing

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build the project:**

   ```bash
   npm run build
   ```

3. **Run tests:**

   ```bash
   npm run test:run
   ```

4. **Development mode (watch):**

   ```bash
   npm run dev
   ```

### Local Package Testing

1. **Build and pack locally:**

   ```bash
   npm run build
   npm pack
   ```

2. **Create test project:**

   ```bash
   mkdir test-app
   cd test-app
   npm init -y
   npm install ../99xio-xians-sdk-typescript-1.2.3.tgz
   ```

3. **Test the package:**

   ```javascript
   // test.js
   const { RestSDK } = require('@99xio/xians-sdk-typescript');
   
   console.log('Testing SDK package');
   const sdk = new RestSDK({ baseUrl: 'test', apiKey: 'test' });
   console.log('SDK created successfully:', !!sdk);
   ```

### Package Inspection

```bash
# List package contents
npm pack --dry-run

# View package metadata
npm view @99xio/xians-sdk-typescript

# Check bundle size
npm run build && ls -lah dist/
```

---

## Troubleshooting

### Common Issues

1. **npm Authentication Error:**

   ```bash
   # Re-login to npm
   npm logout
   npm login
   
   # Verify login
   npm whoami
   ```

2. **Version Already Exists:**

   ```bash
   # Error: Package version already exists
   # Solution: Increment version number or use pre-release suffix
   npm version patch  # 1.2.3 -> 1.2.4
   npm version minor  # 1.2.3 -> 1.3.0
   npm version major  # 1.2.3 -> 2.0.0
   ```

3. **Build Errors:**

   ```bash
   # Clean and rebuild
   rm -rf dist/ node_modules/
   npm install
   npm run build
   ```

4. **Test Failures:**

   ```bash
   # Run tests with UI
   npm run test:ui
   
   # Run specific test
   npm test -- --grep "specific test name"
   ```

### GitHub Actions Failures

1. **Missing NPM_TOKEN Secret:**
   - Go to repository Settings → Secrets and variables → Actions
   - Add `NPM_TOKEN` secret with your npm access token

2. **Version Format Issues:**
   - Ensure tags follow semantic versioning: `v1.2.3` or `v1.2.3-beta`
   - Check tag creation: `git tag -l`

3. **Build Failures:**
   - Check Actions tab for detailed error logs
   - Verify Node.js version compatibility
   - Ensure all dependencies can be installed

4. **Permission Issues:**
   - Verify npm token has publish permissions
   - Check @99xio organization membership
   - Ensure token hasn't expired

### Package Consumption Issues

1. **Package Not Found:**

   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Try different registry
   npm install @99xio/xians-sdk-typescript --registry https://registry.npmjs.org
   ```

2. **Version Conflicts:**

   ```bash
   # Check installed packages
   npm list @99xio/xians-sdk-typescript
   
   # Update to latest
   npm update @99xio/xians-sdk-typescript
   ```

3. **TypeScript Errors:**

   ```bash
   # Ensure TypeScript types are included
   # Check tsconfig.json compatibility
   # Verify import paths are correct
   ```

### Local Development Issues

1. **Build Issues:**

   ```bash
   # Check rollup configuration
   npm run build -- --verbose
   
   # Verify TypeScript compilation
   npx tsc --noEmit
   ```

2. **Import/Export Issues:**

   ```bash
   # Check built files
   ls -la dist/
   
   # Verify exports in package.json
   cat package.json | grep -A 5 '"main"'
   ```

---

## Package Structure

The @99xio/xians-sdk-typescript package includes:

### Main Exports

- **AgentSDK** - Main SDK class
- **RestSDK** - HTTP/REST API client
- **SocketSDK** - WebSocket/SignalR client
- **SseSDK** - Server-Sent Events client

### Built Files

- `dist/index.js` - CommonJS bundle
- `dist/index.esm.js` - ES Modules bundle
- `dist/index.d.ts` - TypeScript definitions
- Source maps for debugging

### Dependencies

- **@microsoft/signalr** (^8.0.7) - SignalR client library

### Compatibility

- **Node.js**: >= 16.0.0
- **TypeScript**: >= 4.0.0
- **Browsers**: Modern browsers with ES2020 support

---

## Additional Resources

- [npm Package Page](https://www.npmjs.com/package/@99xio/xians-sdk-typescript)
- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/) 