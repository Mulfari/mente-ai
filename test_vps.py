import paramiko

host = '177.7.46.156'
user = 'root'
password = "L3l'cyvqq4M;uGhd@Jf@"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, allow_agent=False, look_for_keys=False)

# Check if new code is running
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/health')
print('HEALTH:', stdout.read().decode().strip())

# Test that summarize exists
stdin, stdout, stderr = client.exec_command('grep -c "summarize" /root/vechat-orchestrator/src/index.ts')
print('SUMMARIZE IN INDEX:', stdout.read().decode().strip())

stdin, stdout, stderr = client.exec_command('grep -c "summarize" /root/vechat-orchestrator/src/orchestrator.ts')
print('SUMMARIZE IN ORCHESTRATOR:', stdout.read().decode().strip())

client.close()