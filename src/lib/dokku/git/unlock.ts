import { NodeSSH, SSHExecOptions } from 'node-ssh';

export const unlock = async (
  ssh: NodeSSH,
  appName: string,
  options?: SSHExecOptions,
) => {
  const resultGitUnlock = await ssh.execCommand(
    `dokku git:unlock ${appName} --force`,
    options,
  );
  return resultGitUnlock;
};
