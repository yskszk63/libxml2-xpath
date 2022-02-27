test:
	rm -rf cov
	deno test --unstable --allow-ffi --allow-net --coverage=cov
	deno coverage cov --lcov > cov/lcov
	genhtml -o cov cov/lcov
