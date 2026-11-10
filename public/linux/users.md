# Users lab | Create, modify, lock and remove local accounts

A user has a UID, a primary group, optional supplementary groups, a home
directory and a login shell. Local account metadata lives in `/etc/passwd`.
Protected password hashes and aging settings live in `/etc/shadow`. Use
`getent` and account tools to inspect and modify accounts.

Run this in a disposable VM. Confirm the example names are unused. Keep these
accounts until you finish the Groups lab.

## 1. Create two users

```bash
getent passwd labalice
getent passwd labbob
getent group labalice
getent group labbob
sudo useradd -m -U -s /bin/bash -c 'Alice Linux Lab' labalice
sudo useradd -m -U -s /bin/bash -c 'Bob Linux Lab' labbob
sudo passwd labalice
sudo passwd labbob
```

`-m` creates the home directory, `-U` creates a user-private group, and
`-s` chooses the login shell. Use the interactive prompts for passwords.

## 2. Verify and modify Alice

```bash
getent passwd labalice
id labalice
sudo -iu labalice whoami
sudo -iu labalice pwd
sudo usermod -c 'Alice Storage Lab' labalice
sudo chage -M 90 -W 7 labalice
sudo chage -l labalice
getent passwd labalice
```

The login test should show `labalice` and `/home/labalice`. The aging settings
expire the password after 90 days and begin warnings seven days before expiry.

## 3. Lock and unlock the password

```bash
sudo passwd -l labalice
sudo passwd -S labalice
sudo passwd -u labalice
sudo passwd -S labalice
```

Locking blocks password authentication. It does not revoke SSH keys or end an
existing session. A complete account suspension also requires handling other
authentication methods, active sessions and services using the account.

## 4. Remove the lab accounts after the Groups lab

```bash
# Preserve any files you need, and end the lab accounts' sessions first.
sudo userdel -r labalice
sudo userdel -r labbob
getent passwd labalice
getent passwd labbob
```

`-r` removes the home directory and mail spool. Files outside the home
directory can retain the numeric UID and should be reviewed separately.
