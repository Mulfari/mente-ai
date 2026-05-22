import paramiko

host = '177.7.46.156'
user = 'root'
password = "L3l'cyvqq4M;uGhd@Jf@"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, allow_agent=False, look_for_keys=False)

stdin, stdout, stderr = client.exec_command('find /root -maxdepth 3 -type f \\( -name "orchestrat*" -o -name "index.js" -o -name "index.ts" \\) 2>/dev/null | grep -v node_modules | head -20')
print("FILES:")
print(stdout.read().decode())
print("STDERR:")
print(stderr.read().decode())

stdin, stdout, stderr = client.exec_command('ls /root/')
print("\nROOT DIRS:")
print(stdout.read().decode())

client.close()