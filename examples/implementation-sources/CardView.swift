import SwiftUI

struct CardView<Header: View>: View {
    var title: String
    @ViewBuilder var header: () -> Header

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header()
            Text(title).font(.title2.bold())
        }.padding(24)
    }
}
