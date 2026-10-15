<script>
import { restore } from './utils/auth'

export default {
  onLaunch() { restore() },
}
</script>

<style>
page { background: #f6f7f9; color: #1c2330; font-size: 28rpx; }
.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin: 20rpx; }
.card-title { font-size: 30rpx; font-weight: 600; margin-bottom: 8rpx; }
.card-sub { color: #6b7484; font-size: 24rpx; margin-bottom: 16rpx; }
.grid { display: flex; flex-wrap: wrap; }
.stat { width: 50%; padding: 12rpx 0; }
.stat .label { color: #6b7484; font-size: 24rpx; }
.stat .value { font-size: 36rpx; font-weight: 600; }
.rise { color: #d0342c; }
.fall { color: #1a8f4c; }
.row { display: flex; justify-content: space-between; padding: 14rpx 0; border-bottom: 1rpx solid #eef0f3; }
.muted { color: #6b7484; }
.note { color: #8a5a00; background: #fff6e0; border-radius: 10rpx; padding: 14rpx; margin: 20rpx; font-size: 24rpx; }
.state { text-align: center; padding: 80rpx 20rpx; color: #6b7484; }
.btn { background: #2f5d9b; color: #fff; border-radius: 12rpx; padding: 18rpx; text-align: center; margin-top: 16rpx; }
.btn.ghost { background: #eaf1fb; color: #2f5d9b; }
.input { border: 1rpx solid #e3e6eb; border-radius: 10rpx; padding: 16rpx; margin-top: 12rpx; background: #fff; }
.foot { color: #9aa3b2; font-size: 22rpx; text-align: center; padding: 30rpx 20rpx 60rpx; }
</style>
