WARNING
-------

This is **ALPHA** quality software, if that. It will eat your mail. It will set fire to your computers. It will 
destroy the entire internet. Or...it may just slow down spammers and keep some load off of your server.

mailshield
==========

SMTP proxy for defending mailservers

Affero-GPL-v3 licensed.

The [mailshield wiki](../../wiki) has documentation

mailshield is designed to protect mailservers from common attacks. It implements a Spamhaus ZEN blacklist lookup
(and correctly interprets sbl-xbl vs. pbl listings). It also implements several throttles to common attacks seen
on the internet - dictionary attack prevention for usernames (invalid RCPT TO's), excessive SMTP authentication failure
blocking, and even absolute limits on sending mail from one IP.

It is designed to run in very little memory (around 20-100MB on my test machine so far, but that will increase as the
various block lists grow), and should enable very high concurrent connections without using up all memory on the host 
machine.

It should have relatively 'sane' out-of-the-box defaults for most small to mid-size email systems administrators, but
can be configured relatively easily.

It is just a simple SMTP proxy that introspects on some of the messages that pass through it. It does not implement a
full SMTP stack. This may change in the future, but right now it seems best to leave the nitty-gritty details of SMTP
to the mailservers that have been doing it for 10 or more years.

It is implemented in Node.js right now, but I'm not averse to reimplementing it in C once we figure out what we're 
doing. In Node, it should be able to handle very high concurrency without forking out a ton of processes or taking up
too much memory. We can do that in C using select() - and that may be something that we want to explore.
