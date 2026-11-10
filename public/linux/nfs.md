# NFS lab | Export a directory and mount it on another Linux machine

NFS lets a Linux client access a directory stored on a server. This lab uses
NFSv4.2 on two systemd VMs on an isolated lab network. Examples use server
`192.168.56.10` and client `192.168.56.20`. Replace them with your real private
addresses. Use a lab server with no existing NFSv4 root export.

## 1. Install the packages

```bash
# Server: Ubuntu/Debian
sudo apt update
sudo apt install nfs-kernel-server

# Client: Ubuntu/Debian
sudo apt update
sudo apt install nfs-common

# Fedora/RHEL: run on each VM instead
sudo dnf install nfs-utils
```

## 2. Create a shared identity on both VMs

In this lab, `sec=sys` uses client-supplied Unix identities. Use the same
numeric UID and GID on both machines. Run the commands below on **both** VMs
after confirming that the names and IDs are unused. If they are taken, choose
a free pair and use that same pair on both VMs.

```bash
getent passwd 2300
getent group 2300
getent passwd nfslab
getent group nfslab
sudo groupadd -g 2300 nfslab
sudo useradd -u 2300 -g nfslab -m -s /bin/bash nfslab
id nfslab
```

## 3. Configure the server export

```bash
sudo install -d -o root -g nfslab -m 2770 /srv/nfs/lab
echo 'Hello from the NFS server' | sudo tee /srv/nfs/lab/server.txt
sudoedit /etc/exports
```

Add this line. The single client IP limits the export, `fsid=0` makes it the
NFSv4 root for this lab, and `root_squash` maps client UID 0 to an anonymous
identity. The setgid directory makes new entries inherit group `nfslab`.

```exports
/srv/nfs/lab 192.168.56.20(rw,sync,root_squash,no_subtree_check,fsid=0,sec=sys)
```

```bash
# Ubuntu/Debian server
sudo systemctl enable --now nfs-kernel-server

# Fedora/RHEL server, instead
sudo systemctl enable --now nfs-server

# Both
sudo exportfs -rav
sudo exportfs -v
sudo ss -lnt '( sport = :2049 )'
```

If a firewall is active, permit TCP 2049 from the lab client only. With UFW
on the server, the command is
`sudo ufw allow from 192.168.56.20 to any port 2049 proto tcp`. With firewalld,
add this rule to the zone bound to the lab interface. Replace `public` with
that zone if different.

```bash
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --permanent --zone=public --add-rich-rule='rule family="ipv4" source address="192.168.56.20/32" port port="2049" protocol="tcp" accept'
sudo firewall-cmd --reload
```

## 4. Mount and test on the client

```bash
sudo mkdir -p /mnt/nfs-lab
sudo mount -t nfs -o vers=4.2,proto=tcp,sec=sys 192.168.56.10:/ /mnt/nfs-lab
findmnt --mountpoint /mnt/nfs-lab -o TARGET,SOURCE,FSTYPE,OPTIONS
sudo -u nfslab cat /mnt/nfs-lab/server.txt
sudo -u nfslab sh -c 'umask 002; echo "Client write verified" > /mnt/nfs-lab/client.txt'
sudo -u nfslab ls -ln /mnt/nfs-lab
```

On the server, `sudo cat /srv/nfs/lab/client.txt` should print the client's
message. If 4.2 is unavailable on your lab distribution, use `vers=4.1`
consistently. For an NFSv4-only server, use `findmnt` on the client and
`exportfs -v` on the server to check the mount and export.

## 5. Make the mount persistent

Back up `/etc/fstab` on the client, then add:

```fstab
192.168.56.10:/  /mnt/nfs-lab  nfs  rw,vers=4.2,proto=tcp,sec=sys,_netdev,nofail  0  0
```

```bash
sudo findmnt --verify --verbose
sudo systemctl daemon-reload
sudo umount /mnt/nfs-lab
sudo mount /mnt/nfs-lab
findmnt --mountpoint /mnt/nfs-lab
```

`_netdev` declares the network dependency. `nofail` allows systemd to continue
boot if the mount fails. Keep the server running for the AutoFS lab. For cleanup,
remove the client fstab entry, reload systemd, unmount the client and remove the
lab export from `/etc/exports` before running `sudo exportfs -rav` on the server.
Remove the lab-specific firewall rule when finished.

Use `sec=sys` only on the trusted lab network. Root squashing limits UID 0 but
does not authenticate every client-supplied UID. A real multi-user deployment
can use Kerberos, such as `sec=krb5p` for authentication and encryption.

[Red Hat documentation on mounting NFS shares](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/mounting-nfs-shares)
