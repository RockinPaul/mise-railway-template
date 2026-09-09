# Interactive shells only; plain bash --noprofile --norc remains a repair shell.
case $- in *i*) ;; *) return ;; esac

HISTFILE=/root/.bash_history
HISTSIZE=10000
HISTFILESIZE=20000
shopt -s histappend
PROMPT_COMMAND='history -a'
PS1='\u@\h:\w\$ '
eval "$(/usr/local/bin/mise activate bash)"
