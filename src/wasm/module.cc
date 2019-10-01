
#include <emscripten.h>
#include <stdio.h>
#include <fstream>
#include <string.h>
#include <emscripten/fetch.h>
#include "lm/model.hh"

extern "C" {

typedef lm::ngram::QuantArrayTrieModel Model;

bool sINIT = false;
Model *sModel;
struct FetchUserData {
    int fp;
};

void downloadSucceeded(emscripten_fetch_t *fetch) {
    printf("Finished downloading %llu bytes from URL %s.\n", fetch->numBytes, fetch->url);
    FetchUserData *data = reinterpret_cast<FetchUserData*>(fetch->userData);
    void (*cb)(int) = reinterpret_cast<void (*)(int)>(data->fp);
    int rev = 1;
    std::ofstream file("n-gram.binary", std::ofstream::binary);
    file.write(fetch->data, fetch->numBytes);
    file.close();
    if (sINIT == false && sModel == nullptr) {
        lm::ngram::Config config;
        config.load_method = util::POPULATE_OR_READ;
        sModel = new Model("n-gram.binary", config);
        // printf("model order:%d\n", sModel->Order());
        sINIT = true;
        rev = 0;
    }
    cb(rev);
    delete data;
    emscripten_fetch_close(fetch); // Free data associated with the fetch.
    // Start to initialize Model
}

void downloadFailed(emscripten_fetch_t *fetch) {
    printf("Downloading %s failed, HTTP failure status code: %d.\n", fetch->url, fetch->status);
    FetchUserData *data = reinterpret_cast<FetchUserData*>(fetch->userData);
    void (*cb)(int) = reinterpret_cast<void (*)(int)>(data->fp);
    cb(1);
    delete data;
    emscripten_fetch_close(fetch); // Also free data on failure.
}

int32_t FetchNGram(char* path, int fp) {
    int32_t rev = 0;
    if (sINIT != false && sModel != nullptr) {
        // TODO: find a way to call fp after return
        return rev;
    }
    emscripten_fetch_attr_t attr;
    emscripten_fetch_attr_init(&attr);
    FetchUserData *data = new FetchUserData();
    data->fp = fp;
    attr.userData = data;
    strcpy(attr.requestMethod, "GET");
    attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY
                    | EMSCRIPTEN_FETCH_PERSIST_FILE
                    | EMSCRIPTEN_FETCH_APPEND;
    attr.onsuccess = downloadSucceeded;
    attr.onerror = downloadFailed;
    emscripten_fetch(&attr, path);
    return rev;
}

int32_t ReadNGram(char* path, char* filename, int fp) {
    int32_t rev = 0;
    if (sINIT != false && sModel != nullptr) {
        // TODO: find a way to call fp after return
        return rev;
    }
    char newFilename[strlen(filename) + 7];
    sprintf(newFilename, "/node/%s", filename);
    EM_ASM_({
        FS.mkdir('/node');
        FS.mount(NODEFS, { root: UTF8ToString($0) }, '/node');
    }, path);

    lm::ngram::Config config;
    config.load_method = util::POPULATE_OR_READ;
    sModel = new Model(newFilename, config);
    sINIT = true;
    void (*cb)(int) = reinterpret_cast<void (*)(int)>(fp);
    cb(rev);
    return rev;
}

float_t NGramScore(char* data, const int wc, const float defaultScore) {
    // Words are concated in JS land with null-terminated:
    // i.e. 'word1 word2 word3 word4 ' (space is null)
    // Retrieve the words first;
    char* words[wc];
    for(int i = 0; i < wc; i++) {
        words[i] = data;
        data = data + (strlen(words[i]) + 1);
    }
    Model::State state, out_state;
    sModel->NullContextWrite(&state);
    float_t prob = defaultScore;
    if (wc < sModel->Order()) {
        lm::WordIndex word_index = sModel->BaseVocabulary().Index("<s>");
        word_index = sModel->BaseVocabulary().Index(words[0]);
        prob = sModel->BaseScore(&state, word_index, &out_state);
        // printf("put an <s>\n");
    }
    for (size_t i = 0; i < wc; ++i) {
        lm::WordIndex word_index = sModel->BaseVocabulary().Index(words[i]);
        if (word_index == sModel->BaseVocabulary().NotFound()) {
            prob = defaultScore;
            break;
        }
        prob = sModel->BaseScore(&state, word_index, &out_state);
        // printf("index: %lu, word: %s, score:%f\n", i, words[i], prob);
        state = out_state;
    }
    return prob;
}

int main() {
  EM_ASM(
    Module['runtimeInitialized'] = true;
  );
  return 0;
}
}
