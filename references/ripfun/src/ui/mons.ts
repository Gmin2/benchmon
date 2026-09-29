// original pixel creatures for the placeholder cards. each is a 12x12 grid, one char per pixel:
// "." is empty, the rest index the palette
export type Mon = { name: string; type: string; hp: number; price: string; frame: string; bg: string; palette: Record<string, string>; grid: string[]; move: string };

export const MONS: Mon[] = [
  {
    name: "Mossbun", type: "leaf", hp: 60, price: "$2.40", frame: "#7FD36B", bg: "#1E3A24", move: "Soak Up",
    palette: { a: "#3C8A3A", b: "#6CC45A", c: "#0D0D10", d: "#B7F08F" },
    grid: ["....dd......", "...dbbd.....", "....bb......", "...aaaaaa...", "..abbbbbba..", ".abbbbbbbba.", ".abcbbbbcba.", ".abbbbbbbba.", ".abbbddbbba.", "..abbbbbba..", "...aaaaaa...", "............"],
  },
  {
    name: "Voltcube", type: "spark", hp: 70, price: "$5.10", frame: "#F2D34B", bg: "#3A3316", move: "Short Circuit",
    palette: { a: "#8C7A2A", b: "#F2D34B", c: "#0D0D10", d: "#FFF6B8" },
    grid: [".....d......", "....dd......", ".....dd.....", ".....a......", "..aaaaaaaa..", "..abbbbbba..", "..abcbbcba..", "..abbbbbba..", "..abbddbba..", "..abbbbbba..", "..aaaaaaaa..", "...a....a..."],
  },
  {
    name: "Glimmoth", type: "dusk", hp: 50, price: "$9.80", frame: "#B98CFF", bg: "#2A1F3F", move: "Lamp Dust",
    palette: { a: "#6B4CB0", b: "#B98CFF", c: "#0D0D10", d: "#F1E4FF" },
    grid: ["....d..d....", ".....dd.....", "bb..aaaa..bb", "bdb.acca.bdb", "bbbbaaaabbbb", ".bbbaaaabbb.", "..bbaaaabb..", ".bbbaaaabbb.", "bdb.aaaa.bdb", "bb...aa...bb", "............", "............"],
  },
  {
    name: "Pebblet", type: "stone", hp: 90, price: "$1.20", frame: "#A7A7B3", bg: "#26262C", move: "Stay Put",
    palette: { a: "#5E5E68", b: "#9A9AA6", c: "#0D0D10", d: "#6CC45A" },
    grid: ["............", "....dd......", "...dddd.....", "..aaaaaaa...", ".abbbbbbbaa.", ".abbbccbbba.", ".abbbccbbba.", "abbbbbbbbbba", "abbbbbbbbbba", ".abbbbbbbba.", "..aaaaaaaa..", "............"],
  },
  {
    name: "Tidebloop", type: "tide", hp: 60, price: "$3.30", frame: "#5EC8FF", bg: "#142C3D", move: "Undertow",
    palette: { a: "#2C7FB8", b: "#5EC8FF", c: "#0D0D10", d: "#D6F2FF" },
    grid: [".........d..", "........d.d.", ".....a...d..", "....aba.....", "...abbba....", "..abbbbba...", ".abbcbcbba..", ".abbbbbbba..", ".abbdbbbba..", "..abbbbba...", "...aaaaa....", "............"],
  },
  {
    name: "Emberjar", type: "ember", hp: 70, price: "$6.75", frame: "#FF8A4C", bg: "#3D1F14", move: "Slow Burn",
    palette: { a: "#8A8FA0", b: "#C9CFDD", c: "#FF8A4C", d: "#FFD27A" },
    grid: ["...aaaaaa...", "...abbbba...", "..aaaaaaaa..", "..a......a..", ".a...d....a.", ".a..dcd...a.", ".a..dccd..a.", ".a.dcccd..a.", ".a..cccc..a.", ".a...cc...a.", "..aaaaaaaa..", "............"],
  },
];
