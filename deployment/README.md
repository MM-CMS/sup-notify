It is not possible to provision an instance on a network that a user does not have permission to use. However, it is possible to change the ownership of an instance to any user. Since we need an interface on the admin network, we need to provision it to be owned by the admin user, then moved to joyentsup. We also need to copy the private SSH key temporarily in order to access some files on Manta that contain information that cannot live on a public repo. You can safely ignore the dtrace errors when you run mget, so long as the file is retrieved and generated.

To deploy:

1. Provision a base-64 16.3.1 instance owned by admin, with an interface on the admin network.
2. Change ownership of the instance to joyentsup.
3. Reboot and SSH as root.
4. Copy your private key to `/root/.ssh/id_rsa`.
5. Ensure your public key is in the joyentsup account on Triton Cloud.
6. Run one of `export DC=jpc` or `export DC=spc`.

```
chmod 600 /root/.ssh/id_rsa
echo nameserver 8.8.8.8 >/etc/resolv.conf
pkgin -y in ruby21-puppet
puppet apply <(curl https://raw.githubusercontent.com/andrewh1978/sup/master/sup.pp)
export MANTA_KEY_ID=$(ssh-keygen -E md5 -l -f /root/.ssh/id_rsa | cut -b 10-56)
export MANTA_URL=https://us-east.manta.joyent.com
export MANTA_USER=<Manta user ID>
mget /joyentsup/stor/sup/profile.$DC >/root/.profile
mget /joyentsup/stor/sup/sdc-config.json >/root/toolbox/node_modules/sdc/etc/config.json
mget /joyentsup/stor/sup/$DC.json >/opt/local/lib/node_modules/sup-notify/etc/dc.json
rm -f /root/.ssh/id_rsa
```
