```
emcc module.cc -o module.html -I../../kenlm-wasm/kenlm/include -I../../kenlm-wasm/boost_1_71_0/build/include -L../../kenlm-wasm/boost_1_71_0/build/lib/ -L../../kenlm-wasm/kenlm/build/lib -L${HOME}/.emscripten_cache/asmjs -lboost -lkenlm -lkenlm_util -lz -s EXPORTED_FUNCTIONS='["_main", "_NGramScore", "_FetchNGram"]' -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "stringToUTF8", "addFunction"]' -s ALLOW_MEMORY_GROWTH=1 -s RESERVED_FUNCTION_POINTERS=20 -s FETCH=1 -DKENLM_MAX_ORDER=6 -O3
```
