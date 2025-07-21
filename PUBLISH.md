# Publishing Guide for @99xio/xians-sdk-typescript

This guide walks you through publishing the `@99xio/xians-sdk-typescript` package to npm.

## Prerequisites

1. **npm account**: Create one at [npmjs.com](https://npmjs.com)
2. **npm CLI**: Ensure you have npm installed
3. **Organization access**: You need to be a member of the `@99xio` organization on npm with publish permissions
4. **Repository access**: You need permissions to publish to the package name

### Organization Setup

To publish under the `@99xio` scope, ensure you have the necessary permissions:

```bash
# Check if you're a member of the organization
npm org ls 99xio

# Or check your organizations
npm access list-organizations
```

If you don't have access, contact an organization admin to add you.

## Pre-Publishing Checklist

### 1. Version Management

Update the version in `package.json` following [Semantic Versioning](https://semver.org/):

- **PATCH** (1.0.1): Bug fixes
- **MINOR** (1.1.0): New features, backward compatible
- **MAJOR** (2.0.0): Breaking changes

```bash
# Update version automatically
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0
npm version major   # 1.0.0 -> 2.0.0
```

### 2. Build the Package

```bash
npm run build
```

### 3. Test the Build

Verify the built files exist:

```bash
ls -la dist/
# Should contain:
# - index.js (CommonJS)
# - index.esm.js (ES Modules)
# - index.d.ts (TypeScript definitions)
# - Source maps (.map files)
```

## Publishing Steps

### 1. Login to npm

```bash
npm login
```

Enter your npm credentials when prompted.

### 2. Verify Login

```bash
npm whoami
```

### 3. Check Package Contents

Preview what will be published:

```bash
npm publish --dry-run
```

### 4. Publish the Package

For scoped packages (like this one), you need to specify public access:

```bash
npm publish --access public
```

For beta versions:

```bash
# Beta version
npm publish --tag beta --access public
```

## Post-Publishing

### 1. Verify Publication

Check the package on npm:

```bash
npm view @99xio/xians-sdk-typescript
```

### 2. Test Installation

In a separate directory:

```bash
mkdir test-install
cd test-install
npm init -y
npm install @99xio/xians-sdk-typescript
```

### 3. Update Frontend Dependencies

In your frontend project:

```bash
# Remove the local file dependency
npm uninstall @99xio/xians-sdk-typescript

# Install from npm
npm install @99xio/xians-sdk-typescript
```

### 4. Update Documentation

- Update CHANGELOG.md with the new version
- Create a GitHub release if using GitHub
- Update any documentation that references version numbers

## Versioning Strategy

### Development Workflow

1. **Feature Development**: Work on features in branches
2. **Version Bump**: Update version in `package.json`
3. **Build & Test**: Run `npm run build` and test locally
4. **Publish**: Run `npm publish`
5. **Tag**: Create git tags for releases

### Version Examples

```bash
# Bug fix release
npm version patch
npm publish --access public

# New feature release
npm version minor
npm publish --access public

# Breaking change release
npm version major
npm publish --access public
```

## Troubleshooting

### Common Issues

Package name already exists

```bash
# Error: Package name already taken
# Solution: Change the name in package.json
```

Authentication issues

```bash
# Re-login to npm
npm logout
npm login
```

Build failures

```bash
# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run build
```

Permission denied

```bash
# Check if you have publish rights
npm access list packages
```

## Automation (Optional)

### GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Package Scripts

Add helpful scripts to `package.json`:
```json
{
  "scripts": {
    "prepublish": "npm run build",
    "release:patch": "npm version patch && npm publish --access public",
    "release:minor": "npm version minor && npm publish --access public",
    "release:major": "npm version major && npm publish --access public"
  }
}
```

## Maintenance

### Regular Updates

- Keep dependencies up to date
- Monitor for security vulnerabilities
- Respond to issues and pull requests
- Maintain backward compatibility when possible

### Deprecation

If you need to deprecate a version:

```bash
npm deprecate @99xio/xians-sdk-typescript@1.0.0 "This version has critical bugs, please update"
```
