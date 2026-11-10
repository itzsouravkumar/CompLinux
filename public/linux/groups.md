# Groups lab | Supplementary membership and shared permissions

The primary group supplies a process's default group identity. Supplementary
groups allow a user to access resources shared with additional groups. Complete
the account-creation steps in [the Users lab](users.md) before starting.

## 1. Create a group and add members

```bash
getent group labdev
sudo groupadd labdev
sudo usermod -aG labdev labalice
sudo usermod -aG labdev labbob
getent group labdev
id labalice
id labbob
sudo -iu labalice id
```

`-aG` appends supplementary memberships. `-G` by itself replaces that
membership list. Use a new login session after a change. To set a user's primary
group intentionally, use `usermod -g GROUP USER`.

## 2. Create a group workspace and test access

```bash
sudo install -d -o root -g labdev -m 2770 /srv/labdev
stat -c '%A %U:%G %n' /srv/labdev

sudo -iu labalice sh -c 'umask 007; printf "%s\n" "Alice created this" > /srv/labdev/team.txt'
sudo -iu labbob sh -c 'printf "%s\n" "Bob added this" >> /srv/labdev/team.txt'
sudo -iu labalice cat /srv/labdev/team.txt
stat -c '%A %U:%G %n' /srv/labdev/team.txt
```

Mode `2770` enables setgid on the directory, grants owner and group full
directory access, and grants others none. Setgid makes new entries inherit
`labdev`. The example's umask keeps the regular file writable by the group
and private to the team. For all new files to follow a shared permission
policy independent of users' ordinary umasks, configure a default ACL.

## 3. Remove a member and prove access changed

```bash
sudo gpasswd -d labbob labdev
id labbob
sudo -iu labbob cat /srv/labdev/team.txt
# Expected: Permission denied in Bob's new login session
```

Existing processes can keep their old supplementary groups until restarted
or logged out. Root can inspect the workspace independently of this membership
test.

## 4. Clean up

```bash
sudo gpasswd -d labalice labdev
sudo rm /srv/labdev/team.txt
sudo rmdir /srv/labdev
sudo groupdel labdev
getent group labdev
```

Remove lab users using the Users lab cleanup once their exercises are complete.
