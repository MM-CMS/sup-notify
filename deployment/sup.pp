exec { "bash_profile":
  command => "/opt/local/bin/curl https://raw.githubusercontent.com/andrewh1978/sup/master/.bash_profile >/root/.bash_profile",
}

package { "gcc49":
  ensure => installed,
  before => Package["nodejs"],
}

package { "gmake":
  ensure => installed,
}

package { "git":
  ensure => installed,
}

exec { "remove-nodejs":
  command => "/opt/local/bin/pkgin -y rm nodejs",
  unless => "/usr/bin/test ! -f /opt/local/bin/node || /opt/local/bin/node --version | grep -q v0.10.48",
}

package { "nodejs":
  ensure => "0.10.48",
  require => Exec["remove-nodejs"],
  before => [ Exec["install-manta"], Exec["install-sup-notify"], Exec["install-toolbox"] ],
}

exec { "known_hosts":
  command => "/usr/bin/ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts",
  unless => "/usr/bin/test -f /root/.ssh/known_hosts",
}

exec { "install-manta":
  command => "/opt/local/bin/npm install -g manta",
  unless  => "/usr/bin/test -f /opt/local/bin/mget",
}

exec { "install-sup-notify":
  require => [ Package["gcc49"], Package["gmake"], Package["git"], Exec["known_hosts"] ],
  command => "/opt/local/bin/npm install -g git+ssh://git@github.com/joyent/sup-notify.git",
  unless  => "/usr/bin/test -f /opt/local/bin/sup-notify",
  environment => "HOME=/root",
}

exec { "install-sup-notify-templates":
  require => Exec["known_hosts"],
  command => "/opt/local/bin/git clone git@github.com:joyent/triton-cloud-notification-templates.git",
  unless  => "/usr/bin/test -d /opt/local/lib/triton-cloud-notification-templates",
  cwd => "/opt/local/lib",
}

exec { "update-sup-notify-templates":
  require => Exec["known_hosts"],
  command => "/opt/local/bin/git pull",
  unless  => "/usr/bin/test ! -d /opt/local/lib/triton-cloud-notification-templates",
  cwd => "/opt/local/lib/triton-cloud-notification-templates",
}

exec { "download-toolbox":
  require => Package["git"],
  command => "/opt/local/bin/git clone git@github.com:joyent/sup-toolbox.git",
  unless => "/usr/bin/test -d /root/sup-toolbox",
  cwd => "/root",
  notify => Exec["install-toolbox"],
}

exec { "update-toolbox":
  require => Package["git"],
  command => "/opt/local/bin/git pull",
  unless => "/usr/bin/test ! -d /root/sup-toolbox",
  cwd => "/root/sup-toolbox",
  notify => Exec["install-toolbox"],
}

exec { "install-toolbox":
  refreshonly => true,
  command => "/opt/local/bin/npm install",
  cwd => "/root/sup-toolbox",
  environment => "HOME=/root",
}

exec { "link-node":
  require => Exec["download-toolbox"],
  command => "/opt/local/bin/mkdir -p /root/sup-toolbox/node_modules/sdc/build/node/bin && /opt/local/bin/ln -s /opt/local/bin/node /root/sup-toolbox/node_modules/sdc/build/node/bin/node",
}

file { "toolbox":
  path => "/root/toolbox",
  ensure => "link",
  target => "/root/sup-toolbox",
  require => Exec["download-toolbox"],
}
