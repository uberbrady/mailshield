WARNING
-------

This is **ALPHA** quality software, if that. It will eat your mail. It will set fire to your computers. It will 
destroy the entire internet. Or...it may just slow down spammers and keep some load off of your server.

mailshield
==========

SMTP proxy for defending mailservers

Affero-GPL-v3 licensed.

The [mailshield wiki](wiki) has documentation

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

Rationale
---------

I administer a mail server. It's under near-constant attack, and I feel that some of the tools that larger providers
have - IP limits/blocks, etc - aren't as available to small to mid-sized providers like me.

Implementing this as a proxy allows it to sit in front of any SMTP-compliant mailserver - even Windows mailservers
like Exchange.

Everything is designed to be as low-touch as possible, and conservative. No block is permanent. My server itself has
been blocked due to compromised accounts - and stuff like that _happens_, sometimes. So all blocks are temporary in 
nature. This will be enough to prevent spammers from doing their brute-force attacks - just by slowing them down. 
When they can only attempt 10 dictionary attacks per hour, they will have to move on to something else.

But even after all of that, accounts still can get compromised. When they do, they will start sending crazy amounts
of spam. So we have a coarse block on the number of messages that can be sent (done by counting RCPT-TO's) per IP 
per day. It's very high right now - 10000 - but we can adjust that to figure out what makes sense.

I selected the Affero GPL license because I have benefitted immensely from open source software, and I feel that
large commercial providers do too, but do not end up contributing back as much as they should. The Affero license
allows you to use the software and provide commercial services with it; but requires that you make any changes you
use available for others as well.

Future
------

I'd like to drill down to the individual user who is authenticating to the server - so instead of just blocking an IP
address, we can decide that an account looks compromised and 'lock' it automatically. Also would like per-user 
email send throttles - maybe just 1000 per-user per-day, or something like that.

I really like URIBL's to block content - I can see a future where we spool out the contents of the DATA message into a
temporary file, and lookup any URL's in it using SURBL, and maybe even filter the contents to ClamAV or something like
it.

As mailshield continues to gain functionality, it may evolve into a full-fledged SMTP server, replacing the stock
ones used by postfix, qmail, sendmail, and the like. Those servers could still provide 'local delivery' while leaving
the SMTP to mailshield.

IMAP allows dictionary attacks; I'd like to protect that too someday. Maybe just introspect on the various authentication commands, and leave the rest alone. Oh, and maybe get involved with IDLE (blocking in some cases? Not sure. It eats up resources on my server and I can't stop it :()

I'd like to see it handle SSL connections too. Then you don't have to run big dual stacks of servers to listen to SSL on one side and non-SSL on the other.
