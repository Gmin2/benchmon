#!/bin/sh
# lock hasura down once envio has tracked its tables, then hand the process over to envio
node hasura/lock.mjs &
exec envio start
