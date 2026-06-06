function main() {
    const users: string[] = ["a", "b"];

    for (let i = 0; i < 10; i++) {
        if (i > 5) {
            break;
        }
    }

    return 0;
}

extern ffmpeg from "./ffmpeg.o" {
    function toMP3 (input: string, output: string): void
    function toMP4(input: string, output: string): void
    function getDuration(): number
}