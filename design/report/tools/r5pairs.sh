# round 5's picture pairs (round 4's build on :8001, main on :8002): sh r5pairs.sh <shots dir>
O=$1; export FM_PAIR="Round 4|Now"
at() { echo "(()=>{const e=document.querySelector('$1');return e.getBoundingClientRect().top+scrollY-($2)})()"; }
python3 pair.py $O/r5-hero-1440.jpg 1440 900 0 1 "0" "0,0,1440,900" 2500
python3 pair.py $O/r5-features-1440.jpg 1440 900 0 1 "$(at .features 300)" "180,250,1080,420"
python3 pair.py $O/r5-idcards-1440.jpg 1440 900 0 1 "$(at .access 80)" "200,60,1040,620"
python3 pair.py $O/r5-tools-1440.jpg 1440 900 0 1 "$(at .tools 0)" "0,0,1440,900"
python3 pair.py $O/r5-pubs-390.jpg 390 844 1 2 "$(at .pubs__more 600)" ""
python3 pair.py $O/r5-idcards-640.jpg 640 900 0 1 "$(at .access 60)" "0,0,640,620"
python3 pair.py $O/r5-royalty-760.jpg 760 900 0 1 "$(at .royalty__cards 120)" "0,60,760,760"
python3 pair.py $O/r5-features-390.jpg 390 844 1 2 "$(at .features 220)" ""
