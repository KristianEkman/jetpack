import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function getVersionData() {
  const versionFile = path.resolve('version.json');
  if (fs.existsSync(versionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (data.commitHash && data.commitHash !== 'dev') {
        return data;
      }
    } catch (e) {}
  }

  let commitHash = 'dev';
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {}

  const deployedAt = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  return { commitHash, deployedAt };
}

const { commitHash, deployedAt } = getVersionData();

function writeVersionFile() {
  return {
    name: 'write-version-file',
    closeBundle() {
      const outDir = path.resolve('dist');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const data = JSON.stringify({ commitHash, deployedAt }, null, 2);
      fs.writeFileSync(path.join(outDir, 'version.json'), data);
      fs.writeFileSync(path.resolve('version.json'), data);
    }
  };
}

export default defineConfig({
  root: '.',
  define: {
    __GIT_COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE_TIME__: JSON.stringify(deployedAt)
  },
  plugins: [writeVersionFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020'
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
});

