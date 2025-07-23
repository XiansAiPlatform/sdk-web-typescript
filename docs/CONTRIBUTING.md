# Contributing Guide

This guide explains how to contribute to the `@99xio/xians-sdk-typescript` package, including development workflow, testing, and publishing.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Publishing Releases](#publishing-releases)
3. [Manual Publishing (Backup)](#manual-publishing-backup)
4. [Local Development & Testing](#local-development--testing)
5. [Troubleshooting](#troubleshooting)

---

## Development Setup

### Prerequisites

- **Node.js 18+** (matches GitHub Actions environment)
- **npm CLI** 
- **Git** with repository access
- **npm account** with access to @99xio organization (for manual publishing)

### Getting Started

1. **Clone and install:**
   ```bash
   git clone https://github.com/99xio/xians-sdk-typescript.git
   cd xians-sdk-typescript
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

---

## Publishing Releases

### 🚀 Automated Publishing (Recommended)

The repository uses GitHub Actions to automatically build and publish releases when you create version tags.

#### Quick Release Process

1. **Update version in package.json:**
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. **Commit and push changes:**
   ```bash
   git add package.json
   git commit -m "Bump version to 1.2.3"
   git push origin main
   ```

3. **Create and push version tag:**
   ```bash
   export VERSION=1.2.3  # or 1.2.3-beta for pre-release
   git tag -a v$VERSION -m "Release v$VERSION"
   git push origin v$VERSION
   ```

4. **Monitor the build:**
   - Go to the repository's **Actions** tab on GitHub
   - Watch the "Build and Publish to npm" workflow
   - Check [npmjs.com](https://www.npmjs.com/package/@99xio/xians-sdk-typescript) for the published package

#### What the Automation Does

The GitHub Actions workflow automatically:

- ✅ **Validates version format** (semantic versioning: X.Y.Z or X.Y.Z-suffix)
- ✅ **Updates package.json** version to match the git tag
- ✅ **Installs dependencies** with `npm ci`
- ✅ **Runs tests** (specifically `AuthMethodsConsistency.test.ts`)
- ✅ **Builds the package** with `npm run build`
- ✅ **Verifies build output** (index.js, index.esm.js, index.d.ts)
- ✅ **Publishes to npm** with `--access public`
- ✅ **Generates summary** with installation commands

#### Version Tag Examples

**Stable releases:**
- `v1.2.3` → Package version `1.2.3`
- `v2.0.0` → Package version `2.0.0`

**Pre-releases:**
- `v1.2.3-beta` → Package version `1.2.3-beta`
- `v2.0.0-alpha` → Package version `2.0.0-alpha`
- `v1.2.3-rc1` → Package version `1.2.3-rc1`

#### Delete Tag (if needed)

```bash
# Delete local tag
git tag -d v$VERSION

# Delete remote tag
git push origin :refs/tags/v$VERSION
```

### 📋 Published Package Information

- **Package Name**: `@99xio/xians-sdk-typescript`
- **Registry**: [npmjs.com](https://www.npmjs.com/package/@99xio/xians-sdk-typescript)
- **Target**: ES2020, CommonJS + ES Modules
- **Repository**: `https://github.com/99xio/xians-sdk-typescript`

---

## Manual Publishing (Backup)

Use manual publishing only if automated publishing fails or for testing purposes.

### Prerequisites for Manual Publishing

1. **npm organization access:**
   ```bash
   # Check if you're a member of the organization
   npm org ls 99xio
   
   # Or check your organizations
   npm access list-organizations
   ```

2. **npm login:**
   ```bash
   npm login
   npm whoami  # Verify login
   ```

### Manual Publishing Steps

1. **Prepare the release:**
   ```bash
   # Set version
   export VERSION=1.2.3
   
   # Update package.json (if not already done)
   npm version $VERSION --no-git-tag-version
   
   # Install dependencies
   npm ci
   ```

2. **Build and test:**
   ```bash
   # Build the package
   npm run build
   
   # Run tests
   npm run test:run
   
   # Verify build output
   ls -la dist/
   ```

3. **Preview what will be published:**
   ```bash
   npm publish --dry-run
   ```

4. **Publish to npm:**
   ```bash
   npm publish --access public
   ```

5. **Verify publication:**
   ```bash
   npm view @99xio/xians-sdk-typescript
   ```

---

## Local Development & Testing

### Building and Testing Locally

1. **Full build process:**
   ```bash
   npm install
   npm run build
   npm run test:run
   ```

2. **Local package testing:**
   ```bash
   # Build and pack locally
   npm run build
   npm pack
   
   # Test in a separate project
   mkdir test-app && cd test-app
   npm init -y
   npm install ../99xio-xians-sdk-typescript-1.2.3.tgz
   ```

3. **Test the local package:**
   ```javascript
   // test.js
   const { RestSDK, SocketSDK, SseSDK } = require('@99xio/xians-sdk-typescript');
   
   console.log('Testing SDK package');
   const restSDK = new RestSDK({ 
     tenantId: 'test', 
     apiKey: 'test', 
     serverUrl: 'https://test.com' 
   });
   console.log('SDK created successfully:', !!restSDK);
   ```

### Package Inspection

```bash
# List what will be included in the package
npm pack --dry-run

# View published package metadata
npm view @99xio/xians-sdk-typescript

# Check bundle size
npm run build && ls -lah dist/
```

### Using the Package

#### Installation

```bash
# Latest stable
npm install @99xio/xians-sdk-typescript

# Specific version
npm install @99xio/xians-sdk-typescript@1.2.3

# Latest beta
npm install @99xio/xians-sdk-typescript@beta
```

#### Usage Examples

```typescript
// ES Modules (Recommended)
import { RestSDK, SocketSDK, SseSDK } from '@99xio/xians-sdk-typescript';

const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'your-api-key',
  serverUrl: 'https://api.example.com'
});

// CommonJS
const { RestSDK } = require('@99xio/xians-sdk-typescript');
```

---

## Troubleshooting

### GitHub Actions Issues

1. **Missing NPM_TOKEN Secret:**
   - Go to repository Settings → Secrets and variables → Actions
   - Add `NPM_TOKEN` secret with your npm access token

2. **Version Format Errors:**
   ```bash
   # Ensure tags follow semantic versioning
   git tag -l  # List existing tags
   
   # Valid formats: v1.2.3, v1.2.3-beta, v1.2.3-alpha, v1.2.3-rc1
   # Invalid: 1.2.3 (missing 'v'), v1.2 (incomplete version)
   ```

3. **Build Failures:**
   - Check Actions tab for detailed error logs
   - Verify all dependencies can be installed
   - Ensure tests pass locally first

4. **Permission Issues:**
   - Verify npm token has publish permissions
   - Check @99xio organization membership
   - Ensure token hasn't expired

### Manual Publishing Issues

1. **Authentication Errors:**
   ```bash
   # Re-login to npm
   npm logout
   npm login
   
   # Verify login
   npm whoami
   ```

2. **Version Already Exists:**
   ```bash
   # Increment version
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

4. **Package Not Found After Publishing:**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Try different registry
   npm install @99xio/xians-sdk-typescript --registry https://registry.npmjs.org
   ```

### Development Issues

1. **TypeScript Errors:**
   ```bash
   # Verify TypeScript compilation
   npx tsc --noEmit
   
   # Check tsconfig.json compatibility
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

### Main Exports

- **RestSDK** - HTTP/REST API client
- **SocketSDK** - WebSocket/SignalR client  
- **SseSDK** - Server-Sent Events client
- **AgentSDK** - Main SDK class

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

## Versioning Strategy

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/):

- **PATCH** (1.0.1): Bug fixes, backward compatible
- **MINOR** (1.1.0): New features, backward compatible
- **MAJOR** (2.0.0): Breaking changes

### Development Workflow

1. **Feature Development**: Work on features in branches
2. **Version Bump**: Update version in `package.json`
3. **Automated Release**: Push version tag to trigger automated build
4. **Verification**: Verify package is published and working
5. **Documentation**: Update CHANGELOG.md and create GitHub releases

---

## Additional Resources

- [npm Package Page](https://www.npmjs.com/package/@99xio/xians-sdk-typescript)
- [Semantic Versioning](https://semver.org/)
- [npm Documentation](https://docs.npmjs.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions) 