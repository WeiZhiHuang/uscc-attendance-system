<template lang="pug">
v-container
  v-row.text-center
    v-col(@click="form.title = title, titleDialog = true")
      h1.display-2.font-weight-bold {{ title || 'USCC Lab' }}
  v-row.text-right
    v-col
      p.headline {{ timeText }}
  v-row(justify="center")
    v-dialog(v-model="dialog")
      v-card(v-if="member")
        v-card-title.headline {{ member.name }}
        v-card-actions
          v-btn(
            color="green darken-1",
            text,
            @click="handleCheckIn(uid); dialog = false"
          ) (1) Check in {{ latestInOut ? countdownText : '' }}
          v-spacer
          v-btn(
            color="green darken-1",
            text,
            @click="handleCheckOut(uid); dialog = false"
          ) (9) Check out {{ latestInOut ? '' : countdownText }}
      v-card(v-else)
        v-card-title.headline 學生證未註冊
        v-card-actions
          v-btn(
            block,
            color="secondary",
            dark,
            :to="{ path: 'members', query: { uid } }"
          ) 前往註冊
    v-dialog(v-model="titleDialog", max-width=580)
      v-card
        v-card-title
          v-text-field(
            label="Title",
            v-model="form.title",
            autofocus
            @keyup.enter="title = form.title, titleDialog = false"
          )
</template>

<script>
import { ipcRenderer } from "electron";
import { mapActions } from "vuex";
import { dateMixin } from "../mixins/dateMixin";

export default {
  name: "Home",
  mixins: [dateMixin],
  data: () => ({
    title: localStorage.title,
    uid: "",
    member: null,
    latestInOut: true,
    forceShortOut: false,
    timer: null,
    time: Date(),
    dialog: false,
    titleDialog: false,
    form: {
      title: ""
    },
    countdown: -1
  }),
  computed: {
    timeText: ({ time }) =>
      new Date(time)
        .toLocaleString("zh-TW", {
          dateStyle: "full",
          timeStyle: "short",
          hour12: false
        })
        .replace("24:", "00:"),
    notificationTimeText: ({ time }) =>
      new Date(time)
        .toLocaleString("zh-TW", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })
        .replace("24:", "00:"),
    countdownText: ({ countdown }) => (countdown > 0 ? `(${countdown}s)` : "")
  },
  watch: {
    async uid(val) {
      if (val) {
        this.member = await this.getMember(val);
        this.dialog = true;
      }
    },
    async member(val) {
      if (val) {
        addEventListener("keyup", this.handleKeyUp);
        const record = await this.getLatestRecord(val.uid);
        if (record) {
          const { createdAt, updatedAt } = record;
          const six = new Date(new Date(new Date().toDateString() + " 6:"));
          if (createdAt < six && Date.now() > six) this.latestInOut = true;
          else this.latestInOut = createdAt !== updatedAt;
          if (Date.now() - createdAt > 108e6) this.forceShortOut = true;
        } else this.latestInOut = true;
        this.countdown = 5;
      }
    },
    dialog(val) {
      if (!val) {
        this.uid = "";
        this.forceShortOut = false;
        this.countdown = -1;
        removeEventListener("keyup", this.handleKeyUp);
      }
    },
    countdown(val) {
      if (val > 0) setTimeout(() => --this.countdown, 1e3);
      else if (!val) {
        if (this.member)
          this.latestInOut
            ? this.handleCheckIn(this.uid)
            : this.handleCheckOut(this.uid);
        this.dialog = false;
      }
    },
    title(title) {
      localStorage.title = title;
    }
  },
  created() {
    // document.addEventListener("keydown", ({ key }) => {
    //   switch (key) {
    //     case "F8":
    //       break;
    //     default:
    //       break;
    //   }
    // });
  },
  mounted() {
    this.timer = setInterval(() => (this.time = Date()), 500);

    this.uid = this.$route.query.uid;
    if (this.uid) this.$router.replace({ query: null });

    ipcRenderer.on("uid", this.listener);
  },
  beforeDestroy() {
    clearInterval(this.timer);
    ipcRenderer.removeListener("uid", this.listener);
    removeEventListener("keyup", this.handleKeyUp);
  },
  methods: {
    ...mapActions("member", ["getMember"]),
    ...mapActions("record", ["getLatestRecord", "checkIn", "checkOut"]),
    listener(_, uid) {
      if (!this.dialog) this.uid = uid;
      else if (uid !== this.uid) {
        this.countdown = 0;
        setTimeout(() => (this.uid = uid), 1e3);
      }
    },
    handleCheckIn(uid) {
      this.checkIn(uid);
      new Notification("打卡成功", {
        body: `${this.notificationTimeText} ${this.member.name} 進`
      });
    },
    async handleCheckOut(uid) {
      this.checkOut(uid, this.forceShortOut);
      const { createdAt, updatedAt } = await this.getLatestRecord(uid);
      new Notification("打卡成功", {
        body: `${this.notificationTimeText} ${
          this.member.name
        } 出 ${this.toTimeString(updatedAt - createdAt)}`
      });
    },
    handleKeyUp() {
      switch (event.keyCode) {
        case 49:
        case 97:
          this.handleCheckIn(this.uid);
          break;
        case 57:
        case 105:
          this.handleCheckOut(this.uid);
          break;
        default:
          this.countdown = -1;
          return;
      }
      this.dialog = false;
    }
  }
};
</script>
