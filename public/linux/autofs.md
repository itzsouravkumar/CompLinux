# AutoFS lab | Mount NFS on access

AutoFS mounts a share when a process opens its path and can expire the mount
when idle. The master map selects mount roots and map files. An indirect map
uses relative keys below a shared root. A direct map uses absolute path keys.

Use the working server and `nfslab` user from [the NFS lab](nfs.md). The
AutoFS targets are separate from the NFS fstab example. Keep the same version
and server address as in that lab.

## 1. Install on the client

```bash
# Ubuntu/Debian
sudo apt install autofs nfs-common

# Fedora/RHEL instead
sudo dnf install autofs nfs-utils
```

## 2. Add an indirect map

Open `sudoedit /etc/auto.master` and add this unique lab entry:

```text
/mnt/auto-lab  /etc/auto.lab-indirect  --timeout=60
```

Create the map with `sudoedit /etc/auto.lab-indirect`:

```text
share  -fstype=nfs,vers=4.2,proto=tcp,sec=sys,rw  192.168.56.10:/
```

```bash
sudo systemctl enable --now autofs
sudo systemctl reload autofs
sudo automount -m
findmnt -t nfs,nfs4
sudo -u nfslab cat /mnt/auto-lab/share/server.txt
findmnt --mountpoint /mnt/auto-lab/share
```

The `share` key resolves to `/mnt/auto-lab/share`. Accessing the path triggers
the NFS mount. The AutoFS parent may exist before the underlying NFS mount.

## 3. Add a direct map

Add to `/etc/auto.master` if there is no existing entry for this lab map:

```text
/-  /etc/auto.lab-direct  --timeout=60
```

Create `/etc/auto.lab-direct`:

```text
/mnt/auto-lab-direct  -fstype=nfs,vers=4.2,proto=tcp,sec=sys,ro  192.168.56.10:/
```

```bash
sudo systemctl reload autofs
sudo -u nfslab cat /mnt/auto-lab-direct/server.txt
findmnt -t nfs,nfs4 -o TARGET,SOURCE,OPTIONS
sudo -u nfslab touch /mnt/auto-lab-direct/should-fail
# Expected: Read-only file system
```

## 4. Verify expiration and troubleshoot

```bash
cd /
# Close shells and programs holding either AutoFS path.
sleep 90
findmnt -t nfs,nfs4 -o TARGET,SOURCE,OPTIONS
sudo journalctl -u autofs -n 50 --no-pager
```

The actual NFS mounts can expire after the timeout once no process holds or
revisits them. Expiration checks run periodically. The AutoFS trigger can remain
mounted. If access fails, use `sudo automount -m` to confirm the parsed maps,
then check TCP 2049, the export, and the test user's UID/GID.

For cleanup, leave the mount paths, remove the two lab entries from
`/etc/auto.master`, and reload autofs. Delete the two map files once the lab
mounts have expired. Leave the service running if it manages other maps.

[Red Hat documentation on AutoFS and NFS mounts](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_file_systems/mounting-nfs-shares)
