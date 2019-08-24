# N-Gram Score Module in WebAssembly

KenLM is a library that produces n-gram binary and provides query API. It was
written in C++, fortunately, WebAssembly can compile C/C++ program into LLVM
bitcode, load the bitcode into the browser and integrate with JavaScript.

In order to use KenLM library in JavaScript, we need to do the followings:
- Compile the KenLM as static library in LLVM bitcode format
- Write a C program to use the KenLM API to load and query the N-Gram
- Compile the C program and link with KenLM static library into a
  WebAssembly module
- Use JavaScript to load the WebAssembly module and call it to get N-Gram
  score

### Get Emscripten Toolchain
We need emscripten toolchain to compile C/C++ into WebAssembly.
Please follow the instruction [here](https://emscripten.org/docs/getting_started/downloads.html)
to install the toolchain and active the latest version


### Compile KenLM into LLVM bitcode
Since KenLM depends on several libraries, we also need to handle
these libraries.

First, let's compile zlib. It's a common library, `emscripten-core` already provides script to do it.
Make sure you source the `emsdk_env.sh`, then issue the following command:
```
embuilder.py build zlib
```
The static zlib archive is stored under `${HOME}/.emscripten_cache/asmjs/libz.a`

Second, the boost library:
```
wget -O - https://dl.bintray.com/boostorg/release/1.71.0/source/boost_1_71_0.tar.bz2 | tar xj
```

Then build the boost components that are needed by KenLM:
```
cd boost_1_71_0
# Install the tool to compile boost
./bootstrap.sh
# Create a directory for output files
mkdir build
export NO_BZIP2=1
./b2 -a -j8 toolset=emscripten link=static threading=single runtime-link=static variant=release --with-system --with-program_options --with-thread --with-test --prefix=build install
emar rc build/lib/libboost.a build/lib/libboost*.bc 
```
You can find the static lib archive files under `build/lib` directory.

It's time to build KenLM as static library into LLVM bitcode:

```
# Make sure you are not under boost directory and get one level up to 'kenlm-wasm'
wget -O - http://kheafield.com/code/kenlm.tar.gz | tar x

# Need to patch some files in order to compile the kenlm with emcc
patch -p0 < kenlm.patch

# Get into the source directory
cd kenlm

# Create a 'build' directory and get into the directory
mkdir build
cd build

# Use emconfigure to call CMake and generate the make file
emconfigure cmake -DBoost_DEBUG=1 -Dboost_headers_DIR=../boost_1_71_0/build/lib/cmake/boost_headers-1.71.0 -DBoost_DIR=../boost_1_71_0/build/lib/cmake/Boost-1.71.0 -Dboost_program_options_DIR=../boost_1_71_0/build/lib/cmake/boost_program_options-1.71.0 -Dboost_system_DIR=../boost_1_71_0/build/lib/cmake/boost_system-1.71.0 -Dboost_thread_DIR=../boost_1_71_0/build/lib/cmake/boost_thread-1.71.0 -Dboost_unit_test_framework_DIR=../boost_1_71_0/build/lib/cmake/boost_unit_test_framework-1.71.0 -DZLIB_INCLUDE_DIR=${HOME}/.emscripten_ports/zlib/zlib-version_1 -DZLIB_LIBRARY=${HOME}/.emscripten_cache/asmjs -DBUILD_TESTING=0 -DBoost_USE_STATIC_LIBS=ON -DBoost_USE_STATIC_RUNTIME=ON -DBUILD_EXEC=OFF -DBUILD_TESTING=OFF ..

# Use emmake to call make and compile the code
emmake make

# Let's copy some missing header files
cd ..
mkdir -p include/util/double-conversion
cp util/double-conversion/double-conversion.h include/util/double-conversion
cp util/double-conversion/utils.h include/util/double-conversion
```

Well done! You successfully compile KenLM to WebAssembly bitcode.


### Build WebAssembly module to use KenLM
Then you can build the WebAssembly module to use KenLM.
The code is under `src/wasm` directory. The `emcc` compiler generates
3 output files:
- module.js
- module.html
- module.wasm

We need .js and .wasm files. Here is the command to build the module:
```
# Get to the source code directory
cd ../src/wasm

# Use emcc compile to compile the code
emcc module.cc -o module.html -I../../kenlm-wasm/kenlm/include -I../../kenlm-wasm/boost_1_71_0/build/include -L../../kenlm-wasm/boost_1_71_0/build/lib/ -L../../kenlm-wasm/kenlm/build/lib -L${HOME}/.emscripten_cache/asmjs -lboost -lkenlm -lkenlm_util -lz -s EXPORTED_FUNCTIONS='["_main", "_NGramScore", "_FetchNGram"]' -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "stringToUTF8", "addFunction"]' -s ALLOW_MEMORY_GROWTH=1 -s RESERVED_FUNCTION_POINTERS=20 -s FETCH=1 -DKENLM_MAX_ORDER=6 -O3
```
