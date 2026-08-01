import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const versionFilePath = path.join(rootDir, 'version.json');
const distDir = path.join(rootDir, 'dist');
const distVersionFilePath = path.join(distDir, 'version.json');

let commitHash = null;
try {
  commitHash = execSync('git rev-parse --short HEAD', { cwd: rootDir }).toString().trim();
} catch (e) {
  // Git failed (e.g. on Azure build server without .git)
}

let existingData = {};
if (fs.existsSync(versionFilePath)) {
  try {
    existingData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
  } catch (e) {}
}

const finalCommitHash = (commitHash && commitHash !== 'dev')
  ? commitHash
  : (existingData.commitHash || 'dev');

const finalDeployedAt = commitHash
  ? (new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC')
  : (existingData.deployedAt || (new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC'));

const versionData = {
  commitHash: finalCommitHash,
  deployedAt: finalDeployedAt
};

fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

if (fs.existsSync(distDir)) {
  fs.writeFileSync(distVersionFilePath, JSON.stringify(versionData, null, 2));
}

console.log(`📌 Version info generated: ${finalCommitHash} (${finalDeployedAt})`);
