# LVM lab assignment

## Setup and device safety

Use a disposable Linux VM with snapshots and administrator access. These commands
initialize disks and remove volumes. Take a VM checkpoint first. The examples use
Bash and LVM2. Run each exercise separately with its own blank disk(s), except
Questions 3 and 4, which use the same volume. If you reuse disks, complete the
previous cleanup first.

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install lvm2 xfsprogs e2fsprogs

# Fedora/RHEL family, if applicable
sudo dnf install lvm2 xfsprogs e2fsprogs

sudo lsblk -o NAME,PATH,SIZE,TYPE,FSTYPE,MOUNTPOINTS,MODEL
sudo pvs
```

In the examples, `/dev/vdb` and `/dev/vdc` are **blank attached lab disks**.
Replace them with the paths you verified. Never use the OS disk. Before each
exercise, verify the chosen disk has no mounted child, filesystem, or PV to keep.
`wipefs -n` only inspects signatures.

```bash
LAB_DISK=/dev/vdb
sudo lsblk -o NAME,PATH,SIZE,TYPE,FSTYPE,MOUNTPOINTS "$LAB_DISK"
sudo wipefs -n "$LAB_DISK"
```

A physical volume (PV) is a disk or partition initialized for LVM. A volume group
(VG) pools capacity from PVs. A logical volume (LV) is a virtual block device
allocated from that pool. LVM allocates space in physical extents (PEs). The
commands use binary size units: `1G` = 1 GiB and `512M` = 512 MiB. Filesystem
metadata and reserved space make `df` output differ from the LV size.

For exercises that change `/etc/fstab`, back it up before editing. After editing,
run `sudo findmnt --verify --verbose` and `sudo systemctl daemon-reload` on a
systemd VM. Delete only the entries created for the exercise before removing their
LVs. Keep any pre-existing entries.

## 1. Create a 1 GiB ext4 LV, grow it by 512 MiB, snapshot and remove it

Use a blank disk of at least 3 GiB. Keep at least 256 MiB of VG space for the
snapshot after growth. Stop writers before unmounting. If unmount reports a busy
target, change out of the mount and stop the process holding it before retrying.

```bash
sudo pvcreate /dev/vdb
sudo vgcreate vg_lab1 /dev/vdb
sudo lvcreate -L 1G -n lv_main vg_lab1
sudo mkfs.ext4 /dev/vg_lab1/lv_main
sudo mkdir -p /mnt/lab1
sudo mount /dev/vg_lab1/lv_main /mnt/lab1
echo 'LVM practical 1' | sudo tee /mnt/lab1/example.txt
df -hT /mnt/lab1

sudo lvextend -L +512M /dev/vg_lab1/lv_main
sudo resize2fs /dev/vg_lab1/lv_main
sudo lvs -o lv_name,lv_size vg_lab1
df -hT /mnt/lab1

# Unmount first to capture a clean filesystem image for this exercise.
sudo umount /mnt/lab1
sudo lvcreate -s -L 256M -n lv_main_snap /dev/vg_lab1/lv_main
sudo lvs -o lv_name,origin,lv_size,data_percent vg_lab1

# Remove the dependent snapshot before its origin.
sudo lvremove /dev/vg_lab1/lv_main_snap
sudo lvremove /dev/vg_lab1/lv_main
sudo vgremove vg_lab1
sudo pvremove /dev/vdb
sudo rmdir /mnt/lab1
sudo pvs
sudo vgs
sudo lvs
```

The origin grows to 1.50 GiB. The snapshot's 256 MiB stores changed blocks while
the snapshot exists. A classic snapshot becomes invalid if that space fills.

## 2. Mount 400 MiB ext4 and 600 MiB XFS LVs persistently and grow both

Use a blank disk of at least 3 GiB. The two filesystems share one VG but are
separate LVs.

```bash
sudo pvcreate /dev/vdb
sudo vgcreate vg_dual /dev/vdb
sudo lvcreate -L 400M -n lv_ext4 vg_dual
sudo lvcreate -L 600M -n lv_xfs vg_dual
sudo mkfs.ext4 /dev/vg_dual/lv_ext4
sudo mkfs.xfs /dev/vg_dual/lv_xfs
sudo mkdir -p /mnt/lab-ext4 /mnt/lab-xfs
sudo blkid /dev/vg_dual/lv_ext4 /dev/vg_dual/lv_xfs
sudoedit /etc/fstab
```

Add these two lines with the real filesystem UUIDs printed by `blkid`. In
`fstab`, the last field `2` schedules a non-root ext4 filesystem check. XFS uses
`0` for that field.

```fstab
UUID=REPLACE_EXT4_UUID  /mnt/lab-ext4  ext4  defaults  0  2
UUID=REPLACE_XFS_UUID   /mnt/lab-xfs   xfs   defaults  0  0
```

```bash
sudo findmnt --verify --verbose
sudo systemctl daemon-reload
sudo mount /mnt/lab-ext4
sudo mount /mnt/lab-xfs
findmnt --mountpoint /mnt/lab-ext4
findmnt --mountpoint /mnt/lab-xfs

sudo lvextend -L +200M /dev/vg_dual/lv_ext4
sudo resize2fs /dev/vg_dual/lv_ext4
sudo lvextend -L +200M /dev/vg_dual/lv_xfs
sudo xfs_growfs /mnt/lab-xfs
sudo lvs vg_dual
df -hT /mnt/lab-ext4 /mnt/lab-xfs
```

The LVs are now 600 MiB and 800 MiB. Standard XFS tools on the lab distributions
support growing a mounted XFS filesystem. They do not provide a supported shrink
procedure. Reducing the LV first would truncate blocks XFS still expects. To move
to a smaller XFS volume, back up the data, create a smaller filesystem, then
restore and verify the data before retiring the old filesystem. ext4 can shrink
offline with the correct resize order.

Cleanup: remove the two lab entries from `/etc/fstab`, reload systemd, unmount
both paths and remove `vg_dual/lv_ext4`, then `vg_dual/lv_xfs`, `vg_dual`,
and the lab PV in that order.

## 3. Create ext4 on lv_web and mount it persistently on /web

The question starts at “ext4” and omits the initial LV size and VG name. This
example creates a 500 MiB `lv_web` in `vg_web`. Use a blank disk of at least
2 GiB to leave space for Question 4. Use a VM where `/web` is unused.

```bash
sudo pvcreate /dev/vdb
sudo vgcreate vg_web /dev/vdb
sudo lvcreate -L 500M -n lv_web vg_web
sudo mkfs.ext4 /dev/vg_web/lv_web
sudo mkdir -p /web
sudo blkid /dev/vg_web/lv_web
sudoedit /etc/fstab
```

```fstab
UUID=REPLACE_WEB_UUID  /web  ext4  defaults  0  2
```

```bash
sudo findmnt --verify --verbose
sudo systemctl daemon-reload
sudo mount /web
findmnt --mountpoint /web
echo 'web volume data' | sudo tee /web/index.txt
```

Mounting by path reads the fstab entry, so this tests the persistent configuration.
The UUID stays stable when you grow the filesystem.

## 4. Extend mounted lv_web by 200 MiB and grow ext4 online

Continue from Question 3. Confirm the correct filesystem is mounted and there
are at least 200 MiB of free extents.

```bash
findmnt --mountpoint /web -o SOURCE,TARGET,FSTYPE
sudo vgs -o vg_name,vg_free vg_web
df -hT /web

sudo lvextend -L +200M /dev/vg_web/lv_web
sudo resize2fs /dev/vg_web/lv_web
sudo lvs -o lv_name,lv_size vg_web
df -hT /web
cat /web/index.txt
```

`lvextend` grows the block device to 700 MiB. `resize2fs` grows ext4 into the
added space. If the first command succeeds and the second fails, troubleshoot and
retry only `resize2fs`. Repeating `lvextend -L +200M` adds another 200 MiB.

Cleanup after collecting evidence: remove the `/web` entry from fstab, reload
systemd, unmount `/web`, then remove the LV, VG and lab PV as in Question 1.

## 5. Create two PVs with 8 MiB extents and allocate all VG free space

Attach and verify both blank lab disks. `-s 8M` chooses the VG's PE size.
`100%FREE` consumes all extents free at allocation time.

```bash
sudo lsblk -o NAME,PATH,SIZE,TYPE,FSTYPE,MOUNTPOINTS /dev/vdb /dev/vdc
sudo wipefs -n /dev/vdb /dev/vdc
sudo pvcreate /dev/vdb /dev/vdc
sudo vgcreate -s 8M vg_db /dev/vdb /dev/vdc
sudo lvcreate -l 100%FREE -n lv_db vg_db

sudo pvs -o pv_name,vg_name,pv_size,pv_free /dev/vdb /dev/vdc
sudo vgs -o vg_name,pv_count,vg_extent_size,vg_extent_count,vg_free_count vg_db
sudo lvs -o lv_name,vg_name,lv_size,devices /dev/vg_db/lv_db
```

Expected: two PVs, an 8 MiB PE size and zero free extents. LV capacity is the sum
of usable extents after LVM metadata and alignment. Formatting is optional for
this question. Cleanup: remove `vg_db/lv_db`, `vg_db` and both PVs.

## 6. Delete a file, then restore the LV by merging its snapshot

Use a blank disk of at least 2 GiB. A merge rolls the **entire LV** back to the
snapshot point. Save any later data you need elsewhere before merging.

```bash
sudo pvcreate /dev/vdb
sudo vgcreate vg_data /dev/vdb
sudo lvcreate -L 768M -n lv_data vg_data
sudo mkfs.ext4 /dev/vg_data/lv_data
sudo mkdir -p /mnt/lab-data
sudo mount /dev/vg_data/lv_data /mnt/lab-data
echo 'snapshot rollback test' | sudo tee /mnt/lab-data/restore-me.txt
sudo sha256sum /mnt/lab-data/restore-me.txt
sudo umount /mnt/lab-data

sudo lvcreate -s -L 256M -n lv_data_snap /dev/vg_data/lv_data
sudo mount /dev/vg_data/lv_data /mnt/lab-data
sudo rm /mnt/lab-data/restore-me.txt
test ! -e /mnt/lab-data/restore-me.txt && echo 'Deletion verified'
sudo lvs -o lv_name,origin,lv_attr,data_percent vg_data

sudo umount /mnt/lab-data
# The snapshot must also be unmounted if you mounted it elsewhere.
sudo lvconvert --merge /dev/vg_data/lv_data_snap
sudo lvs -o lv_name,origin,lv_attr,data_percent vg_data
```

Only if LVM reports that the merge is deferred, cycle the origin while unmounted:

```bash
sudo lvchange -an /dev/vg_data/lv_data
sudo lvchange -ay /dev/vg_data/lv_data
```

Mount again to verify the restored file:

```bash
sudo mount /dev/vg_data/lv_data /mnt/lab-data
cat /mnt/lab-data/restore-me.txt
sudo sha256sum /mnt/lab-data/restore-me.txt
```

Compare the hashes. The snapshot disappears once the merge completes. After
verification, unmount and remove the remaining origin LV, VG and PV. The VM
checkpoint or an external backup protects against losing the whole VG.

## 7. Create, activate and persist an LVM swap device

Use a blank disk of at least 2 GiB. Swap is a backing area for memory pages. It
has a swap signature and is enabled with `swapon`.

```bash
sudo pvcreate /dev/vdb
sudo vgcreate vg_swaplab /dev/vdb
sudo lvcreate -L 512M -n lv_swap vg_swaplab
sudo mkswap /dev/vg_swaplab/lv_swap
sudo swapon /dev/vg_swaplab/lv_swap
swapon --show
free -h
sudo blkid /dev/vg_swaplab/lv_swap
sudoedit /etc/fstab
```

```fstab
UUID=REPLACE_SWAP_UUID  none  swap  sw  0  0
```

```bash
sudo findmnt --verify --verbose
sudo systemctl daemon-reload
# On the lab VM, after ensuring enough RAM is available:
sudo swapoff /dev/vg_swaplab/lv_swap
sudo swapon -a
swapon --show
```

The lab device should reappear. Cleanup: turn off **this** swap device, remove
its fstab entry, reload systemd and remove the LV, VG and PV. If `swapoff`
fails for lack of memory, stop memory-intensive work before retrying.

## 8. Allocate 50% of the VG, create XFS and grow it

Use a blank disk of at least 3 GiB. `50%VG` means half of the VG's total extents,
subject to extent rounding and available space. `50%FREE` instead uses half of
its currently unallocated extents.

```bash
sudo pvcreate /dev/vdb
sudo vgcreate vg_half /dev/vdb
sudo lvcreate -l 50%VG -n lv_half vg_half
sudo mkfs.xfs /dev/vg_half/lv_half
sudo mkdir -p /mnt/lab-half
sudo mount /dev/vg_half/lv_half /mnt/lab-half

sudo lvdisplay /dev/vg_half/lv_half
sudo vgdisplay vg_half
df -hT /mnt/lab-half

sudo lvextend -L +256M /dev/vg_half/lv_half
sudo xfs_growfs /mnt/lab-half
sudo xfs_info /mnt/lab-half
df -hT /mnt/lab-half
sudo lvdisplay /dev/vg_half/lv_half
sudo vgdisplay vg_half
```

`xfs_growfs` takes the mounted filesystem path and grows XFS to the available
block device size. The VG now has fewer free extents. Unmount and remove the LV,
VG and PV after recording results.

## References

- [Red Hat Enterprise Linux: managing file systems](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/managing_file_systems)
- [Red Hat Enterprise Linux: merging LVM snapshots](https://docs.redhat.com/en/documentation/Red_Hat_Enterprise_Linux/6/html/logical_volume_manager_administration/snapshot_merge)
